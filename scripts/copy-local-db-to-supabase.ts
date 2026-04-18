import './load-env'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'

const COPY_ORDER = [
  'Agency',
  'Talent',
  'User',
  'Client',
  'ClientContact',
  'Deal',
  'Milestone',
  'InvoiceTriplet',
  'Deliverable',
  'ChaseNote',
  'ManualCreditNote',
  'DealExpense',
  'AdminAuditLog',
  'ImpersonationSession',
  'PreviewLog',
  'Session',
  'ResetToken',
] as const

const CHUNK_SIZE = 500

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function main() {
  const localUrl = process.env.DATABASE_URL?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!localUrl || !supabaseUrl || !serviceRole) {
    throw new Error('DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const local = new Client({ connectionString: localUrl })
  await local.connect()

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    for (const table of COPY_ORDER) {
      const countQ = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (countQ.error) throw countQ.error
      const remoteCount = countQ.count ?? 0
      if (remoteCount > 0) {
        throw new Error(`Refusing to copy: Supabase table ${table} already has ${remoteCount} rows`)
      }
    }

    for (const table of COPY_ORDER) {
      const result = await local.query(`SELECT * FROM "${table}"`)
      const rows = result.rows
      if (rows.length === 0) {
        console.log(`[skip] ${table}: 0 rows`)
        continue
      }

      for (const part of chunk(rows, CHUNK_SIZE)) {
        const insert = await supabase.from(table).insert(part as never[], { defaultToNull: true })
        if (insert.error) throw insert.error
      }
      console.log(`[ok] ${table}: copied ${rows.length} rows`)
    }

    console.log('Copy complete.')
  } finally {
    await local.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
