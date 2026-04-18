import "dotenv/config"

/**
 * Delete a User row by email (sessions/tokens cascade; other FKs may block — see error).
 *
 *   DELETE_EMAIL="wrong@example.com" npx tsx scripts/delete-user-by-email.ts
 */

import { getSupabaseServiceRole } from "../src/lib/supabase/service"

async function main() {
  const email = process.env.DELETE_EMAIL?.trim() || process.argv[2]?.trim()
  if (!email) {
    console.error(
      'Usage: DELETE_EMAIL="user@example.com" npx tsx scripts/delete-user-by-email.ts',
    )
    process.exit(1)
  }

  const db = getSupabaseServiceRole()

  const { data: user } = await db.from("User").select("id, role").eq("email", email).maybeSingle()
  if (!user) {
    console.log(`No user found with email: ${email}`)
    return
  }

  const { error } = await db.from("User").delete().eq("id", user.id as string)
  if (error) throw error
  console.log(`Deleted user: ${email} (role=${user.role})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
