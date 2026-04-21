/**
 * Dev seed using Supabase service role. Run:
 *   npm run db:seed
 *
 * Schema changes: use `supabase/migrations/` (SQL) — not Prisma Migrate.
 */
import './load-env'
import { randomUUID } from 'node:crypto'
import { DealStages } from '../src/types/database'
import { InvoicingModels } from '../src/types/database'
import { UserRoles } from '../src/types/database'
import { getSupabaseServiceRole } from '../src/lib/supabase/service'
import { ensureSupabaseAuthUser, setSupabaseAuthPasswordById } from '../src/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// Destructive — `clearDevData()` below truncates every application table.
// Refuse to run under NODE_ENV=production as a final safety net even if someone
// points this script at a prod database by mistake (.env misconfiguration, wrong
// service-role key, etc.).
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'scripts/seed.ts is a destructive dev-only script and refuses to run with NODE_ENV=production.',
  )
}

// Dev-only: password for the seeded test users. Matches the fallback in the
// /login page's dev quick-login buttons (which send "password" if the field is
// blank), so the UI and seed stay in sync. Override via DEV_AUTH_PASSWORD if you
// want a different local password; never set this in any shared or deployed env.
const DEV_PASSWORD = process.env.DEV_AUTH_PASSWORD?.trim() || 'password'

async function provisionDevAuthUser(email: string): Promise<string> {
  try {
    const authUserId = await ensureSupabaseAuthUser(email)
    await setSupabaseAuthPasswordById(authUserId, DEV_PASSWORD)
    return authUserId
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to provision Supabase auth user for ${email}: ${detail}`)
  }
}

/** Delete all rows (FK order: children before parents). */
async function clearDevData(db: SupabaseClient) {
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

async function main() {
  console.log('Seeding via Supabase service role...')
  const db = getSupabaseServiceRole()
  const now = new Date().toISOString()

  console.log('Clearing dev data...')
  await clearDevData(db)

  console.log('Creating Test Agency...')
  const agencyId = randomUUID()
  const { error: agencyErr } = await db
    .from('Agency')
    .insert({
      id: agencyId,
      name: 'Test Agency',
      slug: 'test-agency',
      planTier: 'BETA',
      commissionDefault: 20,
      invoicingModel: InvoicingModels.SELF_BILLING,
      vatRegistered: true,
      createdAt: now,
      updatedAt: now,
    })
  if (agencyErr) throw agencyErr

  const clientId = randomUUID()
  const { error: clientErr } = await db
    .from('Client')
    .insert({
      id: clientId,
      agencyId,
      name: 'Acme Corp',
      paymentTermsDays: 30,
      createdAt: now,
      updatedAt: now,
    })
  if (clientErr) throw clientErr

  const talentId = randomUUID()
  const { error: talentErr } = await db
    .from('Talent')
    .insert({
      id: talentId,
      agencyId,
      name: 'John Doe',
      email: 'john@example.com',
      commissionRate: 20,
      vatRegistered: true,
      createdAt: now,
      updatedAt: now,
    })
  if (talentErr) throw talentErr

  console.log('Provisioning Supabase auth users for dev accounts...')
  const devUsers = [
    { email: 'bhavik@therum.co',       name: 'Bhav',          role: UserRoles.SUPER_ADMIN,  agencyId: null,      talentId: null             },
    { email: 'admin@testagency.com',   name: 'Admin User',    role: UserRoles.AGENCY_ADMIN, agencyId,            talentId: null             },
    { email: 'agent@testagency.com',   name: 'Sarah Agent',   role: UserRoles.AGENT,        agencyId,            talentId: null             },
    { email: 'finance@testagency.com', name: 'James Finance', role: UserRoles.FINANCE,      agencyId,            talentId: null             },
    { email: 'talent@testagency.com',  name: 'John Talent',   role: UserRoles.TALENT,       agencyId,            talentId },
  ] as const

  const userRows = await Promise.all(
    devUsers.map(async (u) => ({
      id: randomUUID(),
      email: u.email,
      name: u.name,
      role: u.role,
      active: true,
      authUserId: await provisionDevAuthUser(u.email),
      createdAt: now,
      updatedAt: now,
      ...(u.agencyId ? { agencyId: u.agencyId } : {}),
      ...(u.talentId ? { talentId: u.talentId } : {}),
    })),
  )

  console.log('Creating Users (Admin, Agent, Finance, Talent)...')
  const { error: usersErr } = await db.from('User').insert(userRows)
  if (usersErr) throw usersErr

  console.log('Creating Deal and Milestones...')
  const dealId = randomUUID()
  const { error: dealErr } = await db
    .from('Deal')
    .insert({
      id: dealId,
      agencyId,
      clientId,
      talentId,
      title: 'Summer Campaign',
      stage: DealStages.ACTIVE,
      commissionRate: 20,
      currency: 'GBP',
      createdAt: now,
      updatedAt: now,
    })
  if (dealErr) throw dealErr

  const { error: msErr } = await db.from('Milestone').insert([
    {
      id: randomUUID(),
      dealId,
      description: 'Deposit',
      grossAmount: 1500,
      invoiceDate: '2026-05-01',
      status: 'INVOICED',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      dealId,
      description: 'Production',
      grossAmount: 3000,
      invoiceDate: '2026-06-01',
      status: 'COMPLETE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      dealId,
      description: 'Final Delivery',
      grossAmount: 500,
      invoiceDate: '2026-07-01',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    },
  ])
  if (msErr) throw msErr

  console.log('Seed completed successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
