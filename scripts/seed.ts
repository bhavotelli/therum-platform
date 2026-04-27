/**
 * Dev seed using Supabase service role. Run:
 *   npm run db:seed
 *
 * Produces two agencies with realistic, multi-stage pipeline data so the
 * platform UI is populated before opening up to real users:
 *   - Test Agency (SELF_BILLING, prefix "TST") — primary, dev login buttons
 *   - Tidal Studios (ON_BEHALF, prefix "TDL") — secondary, dev login buttons
 *
 * Data shape per agency covers every deal stage, invoice state, chase notes,
 * expenses, and at least one credit-note scenario so every screen has content.
 *
 * ---
 * Known limitations (seed does NOT replicate):
 *   - Xero API calls. `invNumber` / `sbiNumber` / `obiNumber` / `cnNumber` /
 *     `comNumber` / `xeroInvId` / `xeroObiId` / `xeroSbiId` / `xeroComId` /
 *     `xeroCnId` on InvoiceTriplet are all NULL. Production sets them via
 *     `complete_xero_push` RPC on approval.
 *   - Xero contact sync. `Client.xeroContactId` / `Talent.xeroContactId` are
 *     NULL. `getAgencyXeroContextForUser` / `buildXeroContactSyncPreview`
 *     won't have data to sync.
 *   - OBI credit-note batching. A single `ManualCreditNote` row exists for
 *     demo; it does NOT go through the OBI+COM+CN atomic approval batch the
 *     real `pushObiCreditNoteToXero` / `amendApprovedObiTriplet` flows
 *     enforce. Don't infer production CN timing from this seed.
 *   - Stripe transfers, payout webhooks, bank detail handling.
 *   - Real auth email verification (dev users are created with
 *     `email_confirm: true` to skip the inbox hop).
 *   - Admin audit log entries for past actions. Only live actions from the
 *     running app populate `AdminAuditLog`.
 *
 * Schema changes: use `supabase/migrations/` (SQL) — not Prisma Migrate.
 */
import './load-env'
import { randomUUID } from 'node:crypto'
import {
  ContactRoles,
  DealStages,
  InvoicingModels,
  UserRoles,
  type ApprovalStatus,
  type ContactRole,
  type DealStage,
  type ExpenseCategory,
  type ExpenseStatus,
  type InvoicingModel,
  type MilestoneStatus,
  type PayoutStatus,
  type UserRole,
} from '../src/types/database'
import { getSupabaseServiceRole } from '../src/lib/supabase/service'
import { ensureSupabaseAuthUser, setSupabaseAuthPasswordById } from '../src/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// ===========================================================================
// Safety guards
// ===========================================================================

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'scripts/seed.ts is a destructive dev-only script and refuses to run with NODE_ENV=production.',
  )
}

const DEV_PASSWORD = process.env.DEV_AUTH_PASSWORD?.trim() || 'password'
if (DEV_PASSWORD.length < 6) {
  throw new Error(
    `DEV_AUTH_PASSWORD must be at least 6 characters (Supabase Auth minimum); got ${DEV_PASSWORD.length}.`,
  )
}

// ===========================================================================
// Relative date anchor
// ===========================================================================
//
// Every relative date in the seed (deals created N days ago, milestones
// invoiced N days ahead, overdue invoices, etc.) is computed as an offset
// from this anchor. Using `new Date()` means the whole dataset stays
// "current" on each run: re-seed tomorrow and the same deal is "6 days ago"
// instead of "5 days ago", so the pipeline always looks lived-in today.
//
// Trade-off: repeat runs on the SAME calendar day produce identical data,
// but runs on different days shift all dates forward by one day. If you
// need true repeatability (e.g. deterministic screenshot tests), pin this
// to an ISO string.
const TODAY = new Date()
const DAY_MS = 86400000
const nowIso = TODAY.toISOString()

function daysAgo(n: number): string {
  return new Date(TODAY.getTime() - n * DAY_MS).toISOString()
}
function daysAhead(n: number): string {
  return new Date(TODAY.getTime() + n * DAY_MS).toISOString()
}
function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

// ===========================================================================
// Factories
// ===========================================================================

// Belt-and-braces guard for the period where dev and prod share one Supabase
// project: refuse to set a password for any email that isn't on a clearly
// throwaway domain. The NODE_ENV=production guard above protects against
// accidentally running the script with prod env wiring, but it doesn't help
// when local dev is already pointed at the prod database — and a typo'd real
// email in the seed list would silently overwrite a real user's password.
const SEED_ALLOWED_EMAIL_DOMAINS = ['therum.local', 'testagency.com', 'tidalstudios.com']

function assertSeedableEmail(email: string): void {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || !SEED_ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new Error(
      `Refusing to provision Supabase auth user for "${email}": only throwaway domains may be seeded (${SEED_ALLOWED_EMAIL_DOMAINS.join(', ')}). Use a synthetic email like superadmin@therum.local.`,
    )
  }
}

async function provisionDevAuthUser(email: string): Promise<string> {
  assertSeedableEmail(email)
  try {
    const authUserId = await ensureSupabaseAuthUser(email)
    await setSupabaseAuthPasswordById(authUserId, DEV_PASSWORD)
    return authUserId
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to provision Supabase auth user for ${email}: ${detail}`)
  }
}

async function clearDevData(db: SupabaseClient) {
  // FK order: children first, then parents.
  const tables = [
    'AdminAuditLog',
    'PreviewLog',
    'ImpersonationSession',
    'Deliverable',
    'DealExpense',
    'ManualCreditNote',
    'ChaseNote',
    'InvoiceTriplet',
    'Milestone',
    'Deal',
    'ClientContact',
    'Client',
    'Talent',
    'Session',
    'ResetToken',
    'User',
    'Agency',
  ]
  for (const table of tables) {
    const { error } = await db.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`clear ${table}: ${error.message}`)
  }
}

type AgencySeedInput = {
  name: string
  slug: string
  dealNumberPrefix: string
  invoicingModel: InvoicingModel
  commissionDefault: number
  vatRegistered: boolean
  vatNumber?: string | null
}

async function createAgency(db: SupabaseClient, input: AgencySeedInput): Promise<string> {
  const id = randomUUID()
  const { error } = await db.from('Agency').insert({
    id,
    name: input.name,
    slug: input.slug,
    planTier: 'BETA',
    commissionDefault: input.commissionDefault,
    invoicingModel: input.invoicingModel,
    vatRegistered: input.vatRegistered,
    vatNumber: input.vatNumber ?? null,
    dealNumberPrefix: input.dealNumberPrefix,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
  if (error) throw new Error(`agency ${input.name}: ${error.message}`)
  return id
}

type DevUserSeed = {
  email: string
  name: string
  role: UserRole
  agencyId: string | null
  talentId?: string | null
}

async function createUsers(db: SupabaseClient, users: DevUserSeed[]) {
  const rows = await Promise.all(
    users.map(async (u) => ({
      id: randomUUID(),
      email: u.email,
      name: u.name,
      role: u.role,
      active: true,
      authUserId: await provisionDevAuthUser(u.email),
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(u.agencyId ? { agencyId: u.agencyId } : {}),
      ...(u.talentId ? { talentId: u.talentId } : {}),
    })),
  )
  const { error } = await db.from('User').insert(rows)
  if (error) throw new Error(`users: ${error.message}`)
  return rows
}

type ClientSeedInput = {
  name: string
  paymentTermsDays?: number
  contacts: { name: string; email: string; role: ContactRole; phone?: string | null }[]
}

async function createClient(db: SupabaseClient, agencyId: string, input: ClientSeedInput): Promise<string> {
  const clientId = randomUUID()
  const { error: cErr } = await db.from('Client').insert({
    id: clientId,
    agencyId,
    name: input.name,
    paymentTermsDays: input.paymentTermsDays ?? 30,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
  if (cErr) throw new Error(`client ${input.name}: ${cErr.message}`)

  if (input.contacts.length > 0) {
    const { error: ccErr } = await db.from('ClientContact').insert(
      input.contacts.map((c) => ({
        id: randomUUID(),
        clientId,
        agencyId,
        name: c.name,
        email: c.email,
        role: c.role,
        phone: c.phone ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })),
    )
    if (ccErr) throw new Error(`client contacts for ${input.name}: ${ccErr.message}`)
  }

  return clientId
}

type TalentSeedInput = {
  name: string
  email: string
  commissionRate: number
  vatRegistered: boolean
  businessType?: 'SELF_EMPLOYED' | 'LTD_COMPANY'
  companyName?: string | null
}

async function createTalent(db: SupabaseClient, agencyId: string, input: TalentSeedInput): Promise<string> {
  const id = randomUUID()
  const { error } = await db.from('Talent').insert({
    id,
    agencyId,
    name: input.name,
    email: input.email,
    commissionRate: input.commissionRate,
    vatRegistered: input.vatRegistered,
    businessType: input.businessType ?? 'SELF_EMPLOYED',
    companyName: input.companyName ?? null,
    portalEnabled: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
  if (error) throw new Error(`talent ${input.name}: ${error.message}`)
  return id
}

type MilestoneSeedInput = {
  description: string
  grossAmount: number
  invoiceDateOffsetDays: number // relative to TODAY; negative = past, positive = future
  status: MilestoneStatus
  payoutStatus?: PayoutStatus
  payoutDaysAgo?: number
  /** If set, also create an InvoiceTriplet for this milestone. */
  invoice?: {
    approvalStatus: ApprovalStatus
    invDueDateDays?: number
    paidDaysAgo?: number | null // null = approved but not paid; undefined = no paid date
    recipientRole?: ContactRole
  }
}

type DealSeedInput = {
  clientId: string
  talentId: string
  title: string
  stage: DealStage
  commissionRate: number
  probability?: number
  /** Days ago the deal was created — backdates createdAt to make pipeline look realistic. */
  createdDaysAgo?: number
  milestones: MilestoneSeedInput[]
}

async function createDeal(
  db: SupabaseClient,
  agencyId: string,
  invoicingModel: InvoicingModel,
  input: DealSeedInput,
): Promise<{ dealId: string; milestoneIds: string[]; tripletIds: string[] }> {
  const createdIso = input.createdDaysAgo !== undefined ? daysAgo(input.createdDaysAgo) : nowIso

  const dealId = randomUUID()
  const { error: dErr } = await db.from('Deal').insert({
    id: dealId,
    agencyId,
    clientId: input.clientId,
    talentId: input.talentId,
    title: input.title,
    stage: input.stage,
    probability: input.probability ?? stageDefaultProbability(input.stage),
    commissionRate: input.commissionRate,
    currency: 'GBP',
    createdAt: createdIso,
    updatedAt: createdIso,
  })
  if (dErr) throw new Error(`deal ${input.title}: ${dErr.message}`)

  // Milestones must be inserted sorted by invoiceDate ASC so the
  // assign_milestone_ref trigger allocates M01 to the earliest, M02 to the
  // next, etc. (matches production approveInvoiceTriplet behaviour.)
  const sortedMilestones = [...input.milestones].sort(
    (a, b) => a.invoiceDateOffsetDays - b.invoiceDateOffsetDays,
  )

  const milestoneIds: string[] = []
  const tripletIds: string[] = []

  for (const m of sortedMilestones) {
    const milestoneId = randomUUID()
    const invoiceIso = m.invoiceDateOffsetDays >= 0 ? daysAhead(m.invoiceDateOffsetDays) : daysAgo(-m.invoiceDateOffsetDays)
    const isComplete = m.status === 'COMPLETE' || m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY'

    const { error: mErr } = await db.from('Milestone').insert({
      id: milestoneId,
      dealId,
      description: m.description,
      grossAmount: String(m.grossAmount),
      invoiceDate: dateOnly(invoiceIso),
      status: m.status,
      completedAt: isComplete ? invoiceIso : null,
      payoutStatus: m.payoutStatus ?? 'PENDING',
      payoutDate: m.payoutDaysAgo !== undefined ? dateOnly(daysAgo(m.payoutDaysAgo)) : null,
      createdAt: createdIso,
      updatedAt: createdIso,
    })
    if (mErr) throw new Error(`milestone ${m.description}: ${mErr.message}`)

    milestoneIds.push(milestoneId)

    if (m.invoice) {
      const tripletId = await createInvoiceTriplet(db, {
        milestoneId,
        invoicingModel,
        grossAmount: m.grossAmount,
        commissionRate: input.commissionRate,
        invoiceDate: invoiceIso,
        invDueDateDays: m.invoice.invDueDateDays ?? 30,
        approvalStatus: m.invoice.approvalStatus,
        invPaidAt:
          m.invoice.paidDaysAgo === undefined
            ? null
            : m.invoice.paidDaysAgo === null
              ? null
              : daysAgo(m.invoice.paidDaysAgo),
        recipientRole: m.invoice.recipientRole ?? null,
      })
      tripletIds.push(tripletId)
    }
  }

  return { dealId, milestoneIds, tripletIds }
}

function stageDefaultProbability(stage: DealStage): number {
  // Mirror DEFAULT_STAGE_PROBABILITY in pipeline/actions.ts.
  switch (stage) {
    case 'PIPELINE': return 10
    case 'NEGOTIATING': return 40
    case 'CONTRACTED': return 80
    case 'ACTIVE': return 100
    case 'IN_BILLING': return 100
    case 'COMPLETED': return 100
  }
}

type InvoiceTripletSeedInput = {
  milestoneId: string
  invoicingModel: InvoicingModel
  grossAmount: number
  commissionRate: number
  invoiceDate: string
  invDueDateDays: number
  approvalStatus: ApprovalStatus
  invPaidAt: string | null
  recipientRole: ContactRole | null
}

async function createInvoiceTriplet(db: SupabaseClient, input: InvoiceTripletSeedInput): Promise<string> {
  const id = randomUUID()
  const commissionAmount = Number((input.grossAmount * (input.commissionRate / 100)).toFixed(2))
  const netPayoutAmount = Number((input.grossAmount - commissionAmount).toFixed(2))

  // issuedAt is immutable post-INSERT per THE-63; set it here once.
  //
  // Seed simplification: for APPROVED triplets we set issuedAt = invoiceDate.
  // In production issuedAt is the actual Xero push timestamp — which can be
  // days/weeks AFTER invoiceDate if approval is delayed. Backdating here keeps
  // seed dates predictable for screenshots/tests; do not infer production
  // semantics from this assignment.
  const issuedAt = input.approvalStatus === 'APPROVED' ? input.invoiceDate : nowIso

  const { error } = await db.from('InvoiceTriplet').insert({
    id,
    milestoneId: input.milestoneId,
    invoicingModel: input.invoicingModel,
    grossAmount: String(input.grossAmount),
    commissionRate: String(input.commissionRate),
    commissionAmount: String(commissionAmount),
    netPayoutAmount: String(netPayoutAmount),
    invoiceDate: dateOnly(input.invoiceDate),
    issuedAt,
    invDueDateDays: input.invDueDateDays,
    approvalStatus: input.approvalStatus,
    recipientContactRole: input.recipientRole,
    invPaidAt: input.invPaidAt,
    xeroCleanupRequired: false,
    createdAt: input.invoiceDate,
    updatedAt: nowIso,
  })
  if (error) throw new Error(`invoice triplet: ${error.message}`)
  return id
}

async function createExpense(
  db: SupabaseClient,
  agencyId: string,
  dealId: string,
  input: {
    description: string
    category: ExpenseCategory
    amount: number
    incurredBy: 'AGENCY' | 'TALENT'
    rechargeable: boolean
    contractSignOff?: boolean
    vatApplicable?: boolean
    status: ExpenseStatus
    approvedById?: string | null
  },
) {
  const { error } = await db.from('DealExpense').insert({
    id: randomUUID(),
    agencyId,
    dealId,
    description: input.description,
    category: input.category,
    amount: String(input.amount),
    currency: 'GBP',
    vatApplicable: input.vatApplicable ?? true,
    incurredBy: input.incurredBy,
    rechargeable: input.rechargeable,
    contractSignOff: input.contractSignOff ?? false,
    status: input.status,
    approvedById: input.approvedById ?? null,
    approvedAt: input.status === 'APPROVED' ? nowIso : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
  if (error) throw new Error(`expense ${input.description}: ${error.message}`)
}

async function createChaseNote(
  db: SupabaseClient,
  agencyId: string,
  tripletId: string,
  createdByUserId: string,
  input: {
    contactedName: string
    contactedEmail: string
    method: 'EMAIL' | 'PHONE' | 'IN_PERSON' | 'OTHER'
    note: string
    daysAgo: number
    nextChaseDaysAhead?: number
  },
) {
  const { error } = await db.from('ChaseNote').insert({
    id: randomUUID(),
    invoiceTripletId: tripletId,
    agencyId,
    createdByUserId,
    contactedName: input.contactedName,
    contactedEmail: input.contactedEmail,
    method: input.method,
    note: input.note,
    nextChaseDate: input.nextChaseDaysAhead !== undefined ? dateOnly(daysAhead(input.nextChaseDaysAhead)) : null,
    createdAt: daysAgo(input.daysAgo),
  })
  if (error) throw new Error(`chase note: ${error.message}`)
}

async function createManualCreditNote(
  db: SupabaseClient,
  agencyId: string,
  input: {
    invoiceTripletId: string
    createdByUserId: string
    cnNumber: string
    amount: number
    reason: string
    cnDaysAgo: number
  },
) {
  const { error } = await db.from('ManualCreditNote').insert({
    id: randomUUID(),
    invoiceTripletId: input.invoiceTripletId,
    agencyId,
    createdByUserId: input.createdByUserId,
    cnNumber: input.cnNumber,
    cnDate: dateOnly(daysAgo(input.cnDaysAgo)),
    amount: String(input.amount),
    reason: input.reason,
    requiresReplacement: false,
    createdAt: daysAgo(input.cnDaysAgo),
  })
  if (error) throw new Error(`credit note ${input.cnNumber}: ${error.message}`)
}

// ===========================================================================
// Agency A — Test Agency (SELF_BILLING, primary, has dev login users)
// ===========================================================================

async function seedPrimaryAgency(db: SupabaseClient) {
  console.log('Seeding Test Agency (SELF_BILLING)...')

  const agencyId = await createAgency(db, {
    name: 'Test Agency',
    slug: 'test-agency',
    dealNumberPrefix: 'TST',
    invoicingModel: InvoicingModels.SELF_BILLING,
    commissionDefault: 20,
    vatRegistered: true,
    vatNumber: 'GB123456789',
  })

  const users = await createUsers(db, [
    { email: 'superadmin@therum.local', name: 'Dev Super',    role: UserRoles.SUPER_ADMIN, agencyId: null    },
    { email: 'agent@testagency.com',   name: 'Sarah Agent',   role: UserRoles.AGENT,       agencyId          },
    { email: 'finance@testagency.com', name: 'James Finance', role: UserRoles.FINANCE,     agencyId          },
  ])
  const financeUserId = users.find((u) => u.role === UserRoles.FINANCE)!.id
  const agentUserId = users.find((u) => u.role === UserRoles.AGENT)!.id

  // --- Clients ---
  console.log('  Clients + contacts...')
  const [cZephyr, cHorizon, cVelocity, cNimbus, cOrbital, cApex, cPinnacle, cQuartz, cSable, cTerra] = await Promise.all([
    createClient(db, agencyId, {
      name: 'Zephyr Studios',
      contacts: [
        { name: 'Olivia Park',  email: 'olivia@zephyr.example',  role: ContactRoles.PRIMARY },
        { name: 'Marcus Lee',   email: 'ap@zephyr.example',      role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Horizon Retail',
      paymentTermsDays: 45,
      contacts: [
        { name: 'Naomi Clarke', email: 'naomi@horizon.example',  role: ContactRoles.PRIMARY },
        { name: 'Finance Team', email: 'ap@horizon.example',     role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Velocity Drinks',
      contacts: [
        { name: 'Ravi Shah',    email: 'ravi@velocity.example',  role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Nimbus Fitness',
      contacts: [
        { name: 'Ellie Porter', email: 'ellie@nimbus.example',   role: ContactRoles.PRIMARY },
        { name: 'Accounts',     email: 'accounts@nimbus.example',role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Orbital Beauty',
      contacts: [
        { name: 'Priya Nair',   email: 'priya@orbital.example',  role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Apex Motors',
      paymentTermsDays: 60,
      contacts: [
        { name: 'Henry Dawson', email: 'henry@apex.example',     role: ContactRoles.PRIMARY },
        { name: 'Invoices',     email: 'invoices@apex.example',  role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Pinnacle Property',
      contacts: [
        { name: 'Chloe Wilson', email: 'chloe@pinnacle.example', role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Quartz Jewellery',
      contacts: [
        { name: 'Simone Laurent', email: 'simone@quartz.example', role: ContactRoles.PRIMARY },
        { name: 'AP Team',        email: 'ap@quartz.example',     role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Sable Fashion',
      contacts: [
        { name: 'Jade Morrison', email: 'jade@sable.example',    role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Terra Travel',
      contacts: [
        { name: 'Daniel Reeve',  email: 'daniel@terra.example',  role: ContactRoles.PRIMARY },
        { name: 'Finance',       email: 'finance@terra.example', role: ContactRoles.FINANCE },
      ],
    }),
  ])

  // --- Talents ---
  console.log('  Talents...')
  const [tAlex, tSam, tJordan, tMorgan, tTaylor, tCasey, tRiley, tAvery, tDrew, tKai, tQuinn, tSkye] = await Promise.all([
    createTalent(db, agencyId, { name: 'Alex Rivera',   email: 'alex@talent.example',   commissionRate: 20, vatRegistered: true,  businessType: 'LTD_COMPANY', companyName: 'Rivera Media Ltd' }),
    createTalent(db, agencyId, { name: 'Sam Okafor',    email: 'sam@talent.example',    commissionRate: 22, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Jordan Blake',  email: 'jordan@talent.example', commissionRate: 18, vatRegistered: true,  businessType: 'LTD_COMPANY', companyName: 'Blake Creative Ltd' }),
    createTalent(db, agencyId, { name: 'Morgan Chen',   email: 'morgan@talent.example', commissionRate: 20, vatRegistered: true }),
    createTalent(db, agencyId, { name: 'Taylor Reid',   email: 'taylor@talent.example', commissionRate: 25, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Casey Nguyen',  email: 'casey@talent.example',  commissionRate: 15, vatRegistered: true,  businessType: 'LTD_COMPANY', companyName: 'Nguyen Content Ltd' }),
    createTalent(db, agencyId, { name: 'Riley Patel',   email: 'riley@talent.example',  commissionRate: 20, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Avery Kim',     email: 'avery@talent.example',  commissionRate: 22, vatRegistered: true }),
    createTalent(db, agencyId, { name: 'Drew Santos',   email: 'drew@talent.example',   commissionRate: 18, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Kai Williams',  email: 'kai@talent.example',    commissionRate: 20, vatRegistered: true,  businessType: 'LTD_COMPANY', companyName: 'Williams Studios Ltd' }),
    createTalent(db, agencyId, { name: 'Quinn Foster',  email: 'quinn@talent.example',  commissionRate: 15, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Skye Morgan',   email: 'skye@talent.example',   commissionRate: 25, vatRegistered: true }),
  ])

  // No dedicated Talent User is seeded: during UAT/Beta the Talent Portal is
  // accessed via the Agent → Talent → Preview Portal path
  // (src/app/(talent-preview)/), not via a direct talent login. Keep the
  // DevUserSeed.talentId field available on the helper for when a real
  // talent login flow is enabled — it's a one-line addition here if needed.

  // --- Deals across every pipeline stage ---
  console.log('  Deals across PIPELINE → COMPLETED...')

  // PIPELINE (3) — early prospects, no milestones yet
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cZephyr, talentId: tAlex, title: 'Zephyr x Alex — Autumn Launch',
    stage: DealStages.PIPELINE, commissionRate: 20, createdDaysAgo: 3,
    milestones: [
      { description: 'Launch hero reel', grossAmount: 8000, invoiceDateOffsetDays: 45, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cHorizon, talentId: tMorgan, title: 'Horizon x Morgan — Loyalty Tease',
    stage: DealStages.PIPELINE, commissionRate: 20, createdDaysAgo: 5,
    milestones: [
      { description: 'Scoping session', grossAmount: 3500, invoiceDateOffsetDays: 30, status: 'PENDING' },
      { description: 'Ideation', grossAmount: 5000, invoiceDateOffsetDays: 50, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cVelocity, talentId: tTaylor, title: 'Velocity x Taylor — Summer Refresh',
    stage: DealStages.PIPELINE, commissionRate: 22, createdDaysAgo: 1,
    milestones: [
      { description: 'Concept deck', grossAmount: 4000, invoiceDateOffsetDays: 60, status: 'PENDING' },
    ],
  })

  // NEGOTIATING (3)
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cNimbus, talentId: tCasey, title: 'Nimbus x Casey — Q3 Fitness Series',
    stage: DealStages.NEGOTIATING, commissionRate: 15, createdDaysAgo: 10,
    milestones: [
      { description: 'Episode 1 — Cardio', grossAmount: 6000, invoiceDateOffsetDays: 28, status: 'PENDING' },
      { description: 'Episode 2 — Strength', grossAmount: 6000, invoiceDateOffsetDays: 56, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cOrbital, talentId: tSkye, title: 'Orbital x Skye — Serum Drop',
    stage: DealStages.NEGOTIATING, commissionRate: 25, createdDaysAgo: 12,
    milestones: [
      { description: 'Launch campaign', grossAmount: 12000, invoiceDateOffsetDays: 40, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cApex, talentId: tJordan, title: 'Apex x Jordan — Motor Show Activation',
    stage: DealStages.NEGOTIATING, commissionRate: 18, createdDaysAgo: 8,
    milestones: [
      { description: 'Stand shoot', grossAmount: 15000, invoiceDateOffsetDays: 35, status: 'PENDING' },
      { description: 'Social cut-downs', grossAmount: 5000, invoiceDateOffsetDays: 49, status: 'PENDING' },
    ],
  })

  // CONTRACTED (3) — signed, not started
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cPinnacle, talentId: tRiley, title: 'Pinnacle x Riley — Portfolio Reveal',
    stage: DealStages.CONTRACTED, commissionRate: 20, createdDaysAgo: 18,
    milestones: [
      { description: 'Launch film', grossAmount: 9000, invoiceDateOffsetDays: 21, status: 'PENDING' },
      { description: 'Event appearance', grossAmount: 3000, invoiceDateOffsetDays: 42, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cQuartz, talentId: tAvery, title: 'Quartz x Avery — Bridal Collection',
    stage: DealStages.CONTRACTED, commissionRate: 22, createdDaysAgo: 22,
    milestones: [
      { description: 'Lookbook', grossAmount: 7500, invoiceDateOffsetDays: 14, status: 'PENDING' },
      { description: 'Campaign video', grossAmount: 10000, invoiceDateOffsetDays: 42, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cSable, talentId: tDrew, title: 'Sable x Drew — Denim Line',
    stage: DealStages.CONTRACTED, commissionRate: 18, createdDaysAgo: 15,
    milestones: [
      { description: 'Studio shoot', grossAmount: 6500, invoiceDateOffsetDays: 28, status: 'PENDING' },
    ],
  })

  // ACTIVE (5) — some milestones complete, some pending
  const dActive1 = await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cTerra, talentId: tKai, title: 'Terra x Kai — Adventure Series',
    stage: DealStages.ACTIVE, commissionRate: 20, createdDaysAgo: 40,
    milestones: [
      { description: 'Episode 1 — Alps', grossAmount: 8000, invoiceDateOffsetDays: -15, status: 'COMPLETE' },
      { description: 'Episode 2 — Atlantic', grossAmount: 8000, invoiceDateOffsetDays: 10, status: 'PENDING' },
      { description: 'Episode 3 — Andes', grossAmount: 8000, invoiceDateOffsetDays: 45, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cZephyr, talentId: tQuinn, title: 'Zephyr x Quinn — Podcast Arc',
    stage: DealStages.ACTIVE, commissionRate: 15, createdDaysAgo: 35,
    milestones: [
      { description: 'Episodes 1-3', grossAmount: 5500, invoiceDateOffsetDays: -5, status: 'COMPLETE' },
      { description: 'Episodes 4-6', grossAmount: 5500, invoiceDateOffsetDays: 25, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cHorizon, talentId: tSam, title: 'Horizon x Sam — Back-to-School',
    stage: DealStages.ACTIVE, commissionRate: 22, createdDaysAgo: 28,
    milestones: [
      { description: 'Hero shoot', grossAmount: 12000, invoiceDateOffsetDays: -3, status: 'COMPLETE' },
      { description: 'Cutdowns', grossAmount: 4000, invoiceDateOffsetDays: 20, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cNimbus, talentId: tTaylor, title: 'Nimbus x Taylor — HIIT Series',
    stage: DealStages.ACTIVE, commissionRate: 25, createdDaysAgo: 45,
    milestones: [
      { description: 'Week 1', grossAmount: 3500, invoiceDateOffsetDays: -20, status: 'COMPLETE' },
      { description: 'Week 2', grossAmount: 3500, invoiceDateOffsetDays: -10, status: 'COMPLETE' },
      { description: 'Week 3', grossAmount: 3500, invoiceDateOffsetDays: 5, status: 'PENDING' },
      { description: 'Week 4', grossAmount: 3500, invoiceDateOffsetDays: 15, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cApex, talentId: tAlex, title: 'Apex x Alex — EV Launch',
    stage: DealStages.ACTIVE, commissionRate: 20, createdDaysAgo: 30,
    milestones: [
      { description: 'Reveal film', grossAmount: 18000, invoiceDateOffsetDays: -8, status: 'COMPLETE' },
      { description: 'Social assets', grossAmount: 4000, invoiceDateOffsetDays: 12, status: 'PENDING' },
    ],
  })

  // Add some expenses to an ACTIVE deal
  await createExpense(db, agencyId, dActive1.dealId, {
    description: 'Flights — London to Zurich', category: 'TRAVEL', amount: 420,
    incurredBy: 'AGENCY', rechargeable: true, contractSignOff: true, status: 'APPROVED', approvedById: financeUserId,
  })
  await createExpense(db, agencyId, dActive1.dealId, {
    description: 'Hotel — 3 nights', category: 'ACCOMMODATION', amount: 680,
    incurredBy: 'AGENCY', rechargeable: true, contractSignOff: true, status: 'PENDING',
  })
  await createExpense(db, agencyId, dActive1.dealId, {
    description: 'Camera rental', category: 'PRODUCTION', amount: 1200,
    incurredBy: 'TALENT', rechargeable: true, contractSignOff: false, status: 'PENDING',
  })

  // IN_BILLING (6) — invoices in various approval + payment states
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cVelocity, talentId: tMorgan, title: 'Velocity x Morgan — Hydration Push',
    stage: DealStages.IN_BILLING, commissionRate: 20, createdDaysAgo: 60,
    milestones: [
      { description: 'Creator series', grossAmount: 9500, invoiceDateOffsetDays: -10, status: 'INVOICED',
        invoice: { approvalStatus: 'PENDING', recipientRole: ContactRoles.PRIMARY } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cOrbital, talentId: tCasey, title: 'Orbital x Casey — Tutorial Pack',
    stage: DealStages.IN_BILLING, commissionRate: 15, createdDaysAgo: 75,
    milestones: [
      { description: 'Tutorial 1', grossAmount: 4000, invoiceDateOffsetDays: -50, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 10, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'READY' },
      { description: 'Tutorial 2', grossAmount: 4000, invoiceDateOffsetDays: -35, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.FINANCE } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cPinnacle, talentId: tKai, title: 'Pinnacle x Kai — Listing Reveals',
    stage: DealStages.IN_BILLING, commissionRate: 20, createdDaysAgo: 90,
    milestones: [
      { description: 'Listing 1', grossAmount: 6000, invoiceDateOffsetDays: -65, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 20, recipientRole: ContactRoles.PRIMARY },
        payoutStatus: 'PAID', payoutDaysAgo: 5 },
      { description: 'Listing 2', grossAmount: 6000, invoiceDateOffsetDays: -40, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.PRIMARY } },
      { description: 'Listing 3', grossAmount: 6000, invoiceDateOffsetDays: -5, status: 'INVOICED',
        invoice: { approvalStatus: 'PENDING', recipientRole: ContactRoles.PRIMARY } },
    ],
  })
  // OVERDUE — invoice date 55 days ago, 30-day terms = overdue by 25 days
  const dOverdue = await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cApex, talentId: tRiley, title: 'Apex x Riley — Test Drive Series',
    stage: DealStages.IN_BILLING, commissionRate: 20, createdDaysAgo: 80,
    milestones: [
      { description: 'Drive 1 — Coastal', grossAmount: 8500, invoiceDateOffsetDays: -55, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', invDueDateDays: 30, paidDaysAgo: null, recipientRole: ContactRoles.FINANCE } },
      { description: 'Drive 2 — Mountain', grossAmount: 8500, invoiceDateOffsetDays: -25, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.FINANCE } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cQuartz, talentId: tDrew, title: 'Quartz x Drew — Engagement Drop',
    stage: DealStages.IN_BILLING, commissionRate: 18, createdDaysAgo: 85,
    milestones: [
      { description: 'Main shoot', grossAmount: 11000, invoiceDateOffsetDays: -45, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 15, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'READY' },
      { description: 'BTS reel', grossAmount: 3000, invoiceDateOffsetDays: -12, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.FINANCE } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cSable, talentId: tSkye, title: 'Sable x Skye — AW Lookbook',
    stage: DealStages.IN_BILLING, commissionRate: 25, createdDaysAgo: 100,
    milestones: [
      { description: 'Editorial shoot', grossAmount: 14000, invoiceDateOffsetDays: -70, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 40, recipientRole: ContactRoles.PRIMARY },
        payoutStatus: 'PAID', payoutDaysAgo: 30 },
      { description: 'Social wave', grossAmount: 4500, invoiceDateOffsetDays: -20, status: 'INVOICED',
        invoice: { approvalStatus: 'PENDING', recipientRole: ContactRoles.PRIMARY } },
    ],
  })

  // Chase notes on the overdue deal
  console.log('  Chase notes on overdue invoices...')
  const overdueTriplet1 = dOverdue.tripletIds[0]
  if (overdueTriplet1) {
    await createChaseNote(db, agencyId, overdueTriplet1, financeUserId, {
      contactedName: 'Invoices', contactedEmail: 'invoices@apex.example',
      method: 'EMAIL', note: 'Emailed AP. Said next run is end of week.',
      daysAgo: 12, nextChaseDaysAhead: 2,
    })
    await createChaseNote(db, agencyId, overdueTriplet1, financeUserId, {
      contactedName: 'Henry Dawson', contactedEmail: 'henry@apex.example',
      method: 'PHONE', note: 'Primary contact pushed it back internally — promised by Friday.',
      daysAgo: 4,
    })
  }

  // COMPLETED (5) — all milestones done and paid
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cTerra, talentId: tAvery, title: 'Terra x Avery — Spring Retreat',
    stage: DealStages.COMPLETED, commissionRate: 22, createdDaysAgo: 150,
    milestones: [
      { description: 'Retreat campaign', grossAmount: 22000, invoiceDateOffsetDays: -110, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 75, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 65 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cZephyr, talentId: tMorgan, title: 'Zephyr x Morgan — Winter Social',
    stage: DealStages.COMPLETED, commissionRate: 20, createdDaysAgo: 180,
    milestones: [
      { description: 'Winter content pack', grossAmount: 9500, invoiceDateOffsetDays: -140, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 100, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 90 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cHorizon, talentId: tJordan, title: 'Horizon x Jordan — Festive',
    stage: DealStages.COMPLETED, commissionRate: 18, createdDaysAgo: 220,
    milestones: [
      { description: 'Festive hero', grossAmount: 15000, invoiceDateOffsetDays: -170, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 130, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 120 },
      { description: 'Festive cutdowns', grossAmount: 5000, invoiceDateOffsetDays: -155, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 115, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 105 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cNimbus, talentId: tSam, title: 'Nimbus x Sam — New Year Series',
    stage: DealStages.COMPLETED, commissionRate: 22, createdDaysAgo: 130,
    milestones: [
      { description: 'NY kickoff', grossAmount: 7500, invoiceDateOffsetDays: -95, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 55, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 45 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.SELF_BILLING, {
    clientId: cOrbital, talentId: tQuinn, title: 'Orbital x Quinn — Glow Collection',
    stage: DealStages.COMPLETED, commissionRate: 15, createdDaysAgo: 110,
    milestones: [
      { description: 'Hero campaign', grossAmount: 8000, invoiceDateOffsetDays: -80, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 45, recipientRole: ContactRoles.PRIMARY },
        payoutStatus: 'PAID', payoutDaysAgo: 35 },
      { description: 'Social wave', grossAmount: 2500, invoiceDateOffsetDays: -65, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 30, recipientRole: ContactRoles.PRIMARY },
        payoutStatus: 'PAID', payoutDaysAgo: 20 },
    ],
  })

  console.log(`  Test Agency done — ${agentUserId ? '3 users' : ''}, ~25 deals across all stages.`)
}

// ===========================================================================
// Agency B — Tidal Studios (ON_BEHALF, no users, impersonation-only)
// ===========================================================================

async function seedSecondaryAgency(db: SupabaseClient) {
  console.log('Seeding Tidal Studios (ON_BEHALF)...')

  const agencyId = await createAgency(db, {
    name: 'Tidal Studios',
    slug: 'tidal-studios',
    dealNumberPrefix: 'TDL',
    invoicingModel: InvoicingModels.ON_BEHALF,
    commissionDefault: 20,
    vatRegistered: true,
    vatNumber: 'GB987654321',
  })

  // Dedicated Agent + Finance users so dev can flip between agencies via the
  // /login quick-login buttons without round-tripping through super-admin
  // impersonation. Super admin still has cross-agency reach via the admin
  // toolbar.
  await createUsers(db, [
    { email: 'agent@tidalstudios.com',   name: 'Leo Agent',    role: UserRoles.AGENT,   agencyId },
    { email: 'finance@tidalstudios.com', name: 'Mia Finance',  role: UserRoles.FINANCE, agencyId },
  ])

  console.log('  Clients + contacts...')
  const [cLuma, cPress, cNorth, cSolace, cAtelier, cPulse] = await Promise.all([
    createClient(db, agencyId, {
      name: 'Luma Cosmetics',
      contacts: [
        { name: 'Sofia Reyes', email: 'sofia@luma.example', role: ContactRoles.PRIMARY },
        { name: 'AP',           email: 'ap@luma.example',    role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Press Athletic',
      paymentTermsDays: 45,
      contacts: [
        { name: 'Max Harding',  email: 'max@press.example',  role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'North Outdoor',
      contacts: [
        { name: 'Anja Pettersen', email: 'anja@north.example', role: ContactRoles.PRIMARY },
        { name: 'Finance',        email: 'ap@north.example',   role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Solace Home',
      contacts: [
        { name: 'Indie Walsh', email: 'indie@solace.example', role: ContactRoles.PRIMARY },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Atelier Wine',
      contacts: [
        { name: 'Julien Bret', email: 'julien@atelier.example', role: ContactRoles.PRIMARY },
        { name: 'Accounts',    email: 'accounts@atelier.example', role: ContactRoles.FINANCE },
      ],
    }),
    createClient(db, agencyId, {
      name: 'Pulse Tech',
      paymentTermsDays: 60,
      contacts: [
        { name: 'Reina Osei',  email: 'reina@pulse.example',  role: ContactRoles.PRIMARY },
      ],
    }),
  ])

  console.log('  Talents...')
  const [tNova, tEmrys, tIris, tRowan, tYuki, tMarlow, tSage, tVex] = await Promise.all([
    createTalent(db, agencyId, { name: 'Nova Hayes',   email: 'nova@talent.example',  commissionRate: 20, vatRegistered: true }),
    createTalent(db, agencyId, { name: 'Emrys Wolfe',  email: 'emrys@talent.example', commissionRate: 22, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Iris Kensho',  email: 'iris@talent.example',  commissionRate: 25, vatRegistered: true, businessType: 'LTD_COMPANY', companyName: 'Kensho Studio Ltd' }),
    createTalent(db, agencyId, { name: 'Rowan Cole',   email: 'rowan@talent.example', commissionRate: 18, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Yuki Tanaka',  email: 'yuki@talent.example',  commissionRate: 20, vatRegistered: true }),
    createTalent(db, agencyId, { name: 'Marlow Finch', email: 'marlow@talent.example', commissionRate: 15, vatRegistered: false }),
    createTalent(db, agencyId, { name: 'Sage Ortega',  email: 'sage@talent.example',  commissionRate: 22, vatRegistered: true, businessType: 'LTD_COMPANY', companyName: 'Ortega Creative Ltd' }),
    createTalent(db, agencyId, { name: 'Vex Rahim',    email: 'vex@talent.example',   commissionRate: 20, vatRegistered: false }),
  ])

  console.log('  Deals across stages...')

  // PIPELINE (2)
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cLuma, talentId: tNova, title: 'Luma x Nova — Lipstick Launch',
    stage: DealStages.PIPELINE, commissionRate: 20, createdDaysAgo: 4,
    milestones: [{ description: 'Campaign film', grossAmount: 7000, invoiceDateOffsetDays: 40, status: 'PENDING' }],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cPress, talentId: tRowan, title: 'Press x Rowan — Run Club',
    stage: DealStages.PIPELINE, commissionRate: 18, createdDaysAgo: 7,
    milestones: [{ description: 'Launch wave', grossAmount: 5000, invoiceDateOffsetDays: 35, status: 'PENDING' }],
  })

  // NEGOTIATING (2)
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cNorth, talentId: tYuki, title: 'North x Yuki — Expedition Line',
    stage: DealStages.NEGOTIATING, commissionRate: 20, createdDaysAgo: 14,
    milestones: [
      { description: 'Pre-launch teaser', grossAmount: 5500, invoiceDateOffsetDays: 21, status: 'PENDING' },
      { description: 'Launch film', grossAmount: 12000, invoiceDateOffsetDays: 49, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cSolace, talentId: tMarlow, title: 'Solace x Marlow — Candle Range',
    stage: DealStages.NEGOTIATING, commissionRate: 15, createdDaysAgo: 9,
    milestones: [{ description: 'Range photoshoot', grossAmount: 6500, invoiceDateOffsetDays: 35, status: 'PENDING' }],
  })

  // CONTRACTED (2)
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cAtelier, talentId: tIris, title: 'Atelier x Iris — Vintage Series',
    stage: DealStages.CONTRACTED, commissionRate: 25, createdDaysAgo: 20,
    milestones: [
      { description: 'Part 1', grossAmount: 9000, invoiceDateOffsetDays: 14, status: 'PENDING' },
      { description: 'Part 2', grossAmount: 9000, invoiceDateOffsetDays: 42, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cPulse, talentId: tSage, title: 'Pulse x Sage — Launch Day',
    stage: DealStages.CONTRACTED, commissionRate: 22, createdDaysAgo: 17,
    milestones: [{ description: 'Launch content', grossAmount: 10000, invoiceDateOffsetDays: 28, status: 'PENDING' }],
  })

  // ACTIVE (3)
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cLuma, talentId: tEmrys, title: 'Luma x Emrys — Skincare Arc',
    stage: DealStages.ACTIVE, commissionRate: 22, createdDaysAgo: 35,
    milestones: [
      { description: 'Part 1', grossAmount: 6000, invoiceDateOffsetDays: -5, status: 'COMPLETE' },
      { description: 'Part 2', grossAmount: 6000, invoiceDateOffsetDays: 15, status: 'PENDING' },
      { description: 'Part 3', grossAmount: 6000, invoiceDateOffsetDays: 35, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cNorth, talentId: tVex, title: 'North x Vex — Alpine Shoot',
    stage: DealStages.ACTIVE, commissionRate: 20, createdDaysAgo: 30,
    milestones: [
      { description: 'Shoot', grossAmount: 13000, invoiceDateOffsetDays: -2, status: 'COMPLETE' },
      { description: 'Edit delivery', grossAmount: 2500, invoiceDateOffsetDays: 18, status: 'PENDING' },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cPress, talentId: tNova, title: 'Press x Nova — Marathon Prep',
    stage: DealStages.ACTIVE, commissionRate: 20, createdDaysAgo: 25,
    milestones: [
      { description: 'Pre-race content', grossAmount: 4500, invoiceDateOffsetDays: -8, status: 'COMPLETE' },
      { description: 'Race day', grossAmount: 7000, invoiceDateOffsetDays: 10, status: 'PENDING' },
    ],
  })

  // IN_BILLING (3)
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cSolace, talentId: tRowan, title: 'Solace x Rowan — Home Series',
    stage: DealStages.IN_BILLING, commissionRate: 18, createdDaysAgo: 70,
    milestones: [
      { description: 'Series hero', grossAmount: 12000, invoiceDateOffsetDays: -30, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.PRIMARY } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cAtelier, talentId: tYuki, title: 'Atelier x Yuki — Harvest Campaign',
    stage: DealStages.IN_BILLING, commissionRate: 20, createdDaysAgo: 80,
    milestones: [
      { description: 'Shoot', grossAmount: 9000, invoiceDateOffsetDays: -48, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 12, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'READY' },
      { description: 'Cutdowns', grossAmount: 3000, invoiceDateOffsetDays: -18, status: 'INVOICED',
        invoice: { approvalStatus: 'PENDING', recipientRole: ContactRoles.FINANCE } },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cPulse, talentId: tMarlow, title: 'Pulse x Marlow — Product Reveal',
    stage: DealStages.IN_BILLING, commissionRate: 15, createdDaysAgo: 95,
    milestones: [
      { description: 'Reveal film', grossAmount: 14000, invoiceDateOffsetDays: -62, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 22, recipientRole: ContactRoles.PRIMARY },
        payoutStatus: 'PAID', payoutDaysAgo: 12 },
      { description: 'Explainer', grossAmount: 4500, invoiceDateOffsetDays: -25, status: 'INVOICED',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: null, recipientRole: ContactRoles.PRIMARY } },
    ],
  })

  // COMPLETED (3) — one has a manual credit note for demo purposes
  const dCompleted1 = await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cLuma, talentId: tSage, title: 'Luma x Sage — Launch Retrospective',
    stage: DealStages.COMPLETED, commissionRate: 22, createdDaysAgo: 140,
    milestones: [
      { description: 'Full campaign', grossAmount: 18000, invoiceDateOffsetDays: -100, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 60, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 50 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cNorth, talentId: tIris, title: 'North x Iris — Glacier Expedition',
    stage: DealStages.COMPLETED, commissionRate: 25, createdDaysAgo: 200,
    milestones: [
      { description: 'Expedition film', grossAmount: 26000, invoiceDateOffsetDays: -160, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 115, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 105 },
    ],
  })
  await createDeal(db, agencyId, InvoicingModels.ON_BEHALF, {
    clientId: cPress, talentId: tVex, title: 'Press x Vex — Training Content',
    stage: DealStages.COMPLETED, commissionRate: 20, createdDaysAgo: 170,
    milestones: [
      { description: 'Training pack', grossAmount: 10000, invoiceDateOffsetDays: -120, status: 'PAID',
        invoice: { approvalStatus: 'APPROVED', paidDaysAgo: 80, recipientRole: ContactRoles.FINANCE },
        payoutStatus: 'PAID', payoutDaysAgo: 70 },
    ],
  })

  // One demo credit note on a completed OBI deal. Requires a super-admin user
  // as creator — we resolve it by finding the super admin User record.
  const { data: superAdminRow } = await db
    .from('User')
    .select('id')
    .eq('role', UserRoles.SUPER_ADMIN)
    .maybeSingle()

  const completedTripletId = dCompleted1.tripletIds[0]
  if (superAdminRow && completedTripletId) {
    await createManualCreditNote(db, agencyId, {
      invoiceTripletId: completedTripletId,
      createdByUserId: superAdminRow.id as string,
      cnNumber: 'TDL-CN-DEMO-01',
      amount: 1500,
      reason: 'Agreed goodwill discount — client extended scope mid-campaign.',
      cnDaysAgo: 40,
    })
  }

  console.log('  Tidal Studios done — ~15 deals, 1 demo credit note.')
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  console.log('Seeding via Supabase service role...')
  const db = getSupabaseServiceRole()

  console.log('Clearing dev data...')
  await clearDevData(db)

  await seedPrimaryAgency(db)
  await seedSecondaryAgency(db)

  console.log('Seed completed successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
