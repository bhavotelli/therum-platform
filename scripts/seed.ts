/**
 * Dev seed using Supabase service role. Run:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/seed.ts
 *
 * Schema changes: use `supabase/migrations/` (SQL) — not Prisma Migrate.
 */
import { DealStages } from '../src/types/database'
import { InvoicingModels } from '../src/types/database'
import { UserRoles } from '../src/types/database'
import { getSupabaseServiceRole } from '../src/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

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

  console.log('Clearing dev data...')
  await clearDevData(db)

  console.log('Creating Test Agency...')
  const { data: agency, error: agencyErr } = await db
    .from('Agency')
    .insert({
      name: 'Test Agency',
      slug: 'test-agency',
      planTier: 'BETA',
      commissionDefault: 20,
      invoicingModel: InvoicingModels.SELF_BILLING,
      vatRegistered: true,
    })
    .select('id')
    .single()
  if (agencyErr || !agency) throw agencyErr ?? new Error('Agency insert failed')
  const agencyId = agency.id as string

  const { data: client, error: clientErr } = await db
    .from('Client')
    .insert({
      agencyId,
      name: 'Acme Corp',
      paymentTermsDays: 30,
    })
    .select('id')
    .single()
  if (clientErr || !client) throw clientErr ?? new Error('Client insert failed')

  const { data: talent, error: talentErr } = await db
    .from('Talent')
    .insert({
      agencyId,
      name: 'John Doe',
      email: 'john@example.com',
      commissionRate: 20,
      vatRegistered: true,
    })
    .select('id')
    .single()
  if (talentErr || !talent) throw talentErr ?? new Error('Talent insert failed')

  console.log('Creating Users (Admin, Agent, Finance)...')
  const { error: usersErr } = await db.from('User').insert([
    {
      role: UserRoles.SUPER_ADMIN,
      active: true,
      email: 'bhavik@therum.co',
      name: 'Bhav',
    },
    {
      agencyId,
      role: UserRoles.AGENCY_ADMIN,
      active: true,
      email: 'admin@testagency.com',
      name: 'Admin User',
    },
    {
      agencyId,
      role: UserRoles.AGENT,
      active: true,
      email: 'agent@testagency.com',
      name: 'Sarah Agent',
    },
    {
      agencyId,
      role: UserRoles.FINANCE,
      active: true,
      email: 'finance@testagency.com',
      name: 'James Finance',
    },
    {
      agencyId,
      talentId: talent.id as string,
      role: UserRoles.TALENT,
      active: true,
      email: 'talent@testagency.com',
      name: 'John Talent',
    },
  ])
  if (usersErr) throw usersErr

  console.log('Creating Deal and Milestones...')
  const { data: deal, error: dealErr } = await db
    .from('Deal')
    .insert({
      agencyId,
      clientId: client.id as string,
      talentId: talent.id as string,
      title: 'Summer Campaign',
      stage: DealStages.ACTIVE,
      commissionRate: 20,
      currency: 'GBP',
    })
    .select('id')
    .single()
  if (dealErr || !deal) throw dealErr ?? new Error('Deal insert failed')

  const { error: msErr } = await db.from('Milestone').insert([
    {
      dealId: deal.id as string,
      description: 'Deposit',
      grossAmount: 1500,
      invoiceDate: '2026-05-01',
      status: 'INVOICED',
    },
    {
      dealId: deal.id as string,
      description: 'Production',
      grossAmount: 3000,
      invoiceDate: '2026-06-01',
      status: 'COMPLETE',
    },
    {
      dealId: deal.id as string,
      description: 'Final Delivery',
      grossAmount: 500,
      invoiceDate: '2026-07-01',
      status: 'PENDING',
    },
  ])
  if (msErr) throw msErr

  console.log('Seed completed successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
