/**
 * Link an app User row to a Supabase Auth user by UUID and optionally fix email.
 *
 * Usage:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/link-auth-user.ts <auth-uuid> <app-user-email-current> [new-email]
 *
 * Example:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/link-auth-user.ts \
 *     9efaf7c3-a83d-4dd1-b353-f615cbe67769 bhavik@therum.co bhavik@therum.com
 */
import "./load-env"
import { getSupabaseServiceRole } from "../src/lib/supabase/service"

async function main() {
  const authId = process.argv[2]
  const currentEmail = process.argv[3]
  const newEmail = process.argv[4]

  if (!authId || !currentEmail) {
    console.error(
      "Usage: …/tsx scripts/link-auth-user.ts <auth-uuid> <app-user-email> [new-email]",
    )
    process.exit(1)
  }

  const db = getSupabaseServiceRole()
  const { data: rows } = await db.from("User").select("id, email, authUserId")
  const row = rows?.find(
    (r) =>
      typeof r.email === "string" &&
      r.email.trim().toLowerCase() === currentEmail.trim().toLowerCase(),
  )
  if (!row) {
    console.error(`No User found with email matching: ${currentEmail}`)
    process.exit(1)
  }

  const patch: { authUserId: string; email?: string } = { authUserId: authId }
  if (newEmail) {
    patch.email = newEmail.trim().toLowerCase()
  }

  const { data: updated, error } = await db
    .from("User")
    .update(patch)
    .eq("id", row.id as string)
    .select("email, authUserId, role")
    .maybeSingle()

  if (error) throw error
  console.log("Updated:", updated)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
