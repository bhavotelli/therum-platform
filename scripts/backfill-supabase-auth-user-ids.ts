/**
 * Links `User.authUserId` to Supabase Auth `auth.users.id` by matching email (case-insensitive).
 *
 * Prerequisites: Supabase project exists; Auth users created for each app user (invite/import).
 *
 * Usage:
 *   DATABASE_URL="..." NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
 *     npx tsx scripts/backfill-supabase-auth-user-ids.ts
 */
import './load-env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import prisma from '../src/lib/prisma'

async function listAllAuthUsers(supabase: SupabaseClient) {
  const all: { id: string; email?: string | null }[] = []
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const chunk = data.users ?? []
    for (const u of chunk) {
      all.push({ id: u.id, email: u.email })
    }
    if (chunk.length < 1000) break
    page += 1
  }
  return all
}

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim()
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !sr) {
    console.error(
      'Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env at the repo root.',
    )
    process.exit(1)
  }

  const supabase = createClient(url, sr, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authUsers = await listAllAuthUsers(supabase)
  const byEmail = new Map(
    authUsers
      .filter((u) => u.email)
      .map((u) => [u.email!.trim().toLowerCase(), u.id]),
  )

  const rows = await prisma.user.findMany({
    where: { authUserId: null },
    select: { id: true, email: true },
  })

  let linked = 0
  for (const u of rows) {
    const authId = byEmail.get(u.email.trim().toLowerCase())
    if (!authId) {
      console.warn(`[skip] No Supabase Auth user with email matching: ${u.email}`)
      continue
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { authUserId: authId },
    })
    console.log(`[ok] ${u.email} -> authUserId ${authId}`)
    linked += 1
  }

  console.log(`Done. Linked ${linked} of ${rows.length} users still missing authUserId.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
