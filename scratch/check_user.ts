/**
 * Quick lookup for a User row by email (Supabase service role).
 *
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scratch/check_user.ts <email>
 */
import { getSupabaseServiceRole } from "../src/lib/supabase/service"

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error("Usage: tsx scratch/check_user.ts <email>")
    process.exit(1)
  }

  const db = getSupabaseServiceRole()
  const { data: user, error } = await db.from("User").select("*").eq("email", email).maybeSingle()
  if (error) throw error
  console.log(user ?? "No user found")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
