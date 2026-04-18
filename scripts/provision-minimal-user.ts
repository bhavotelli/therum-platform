import "dotenv/config"

/**
 * Create a single Agency + User for production without running the full seed.
 *
 * Schema: apply SQL migrations in `supabase/migrations/` (Supabase CLI / dashboard).
 *
 * Super Admin (no agency row — use /admin to invite others):
 *   PROVISION_EMAIL="you@company.com" PROVISION_NAME="Your Name" \\
 *     npx tsx scripts/provision-minimal-user.ts --super-admin
 *
 * Agency user (finance, agent, etc.):
 *   PROVISION_ROLE=FINANCE PROVISION_EMAIL=... AGENCY_NAME="..." AGENCY_SLUG="..." \\
 *     npx tsx scripts/provision-minimal-user.ts
 */

import { InvoicingModels } from "../src/types/database"
import { UserRoles } from "../src/types/database"
import type { UserRole } from "../src/types/database"
import { getSupabaseServiceRole } from "../src/lib/supabase/service"

const ROLES: UserRole[] = [
  UserRoles.SUPER_ADMIN,
  UserRoles.AGENCY_ADMIN,
  UserRoles.AGENT,
  UserRoles.FINANCE,
]

function parseRole(raw: string | undefined): UserRole {
  const r = (raw || "FINANCE").toUpperCase() as UserRole
  if (ROLES.includes(r)) return r
  throw new Error(`Invalid PROVISION_ROLE: ${raw}. Use one of: ${ROLES.join(", ")}`)
}

async function main() {
  const superAdminCli =
    process.argv.includes("--super-admin") ||
    process.argv.includes("super-admin")

  const email = process.env.PROVISION_EMAIL?.trim()
  if (!email) {
    console.error(
      "Set PROVISION_EMAIL to your login email, e.g. PROVISION_EMAIL=you@therum.io",
    )
    process.exit(1)
  }

  const name = (process.env.PROVISION_NAME || "Admin").trim()
  const role = superAdminCli ? UserRoles.SUPER_ADMIN : parseRole(process.env.PROVISION_ROLE)
  const agencyName = process.env.AGENCY_NAME || "My Agency"
  const agencySlug = (process.env.AGENCY_SLUG || "my-agency").toLowerCase().replace(/\s+/g, "-")

  const db = getSupabaseServiceRole()

  const { data: existing } = await db.from("User").select("id").eq("email", email).maybeSingle()
  if (existing) {
    console.log(`User already exists: ${email} (id=${existing.id})`)
    return
  }

  if (role === UserRoles.SUPER_ADMIN) {
    const { error } = await db.from("User").insert({
      email,
      name,
      role: UserRoles.SUPER_ADMIN,
      active: true,
      passwordHash: null,
    })
    if (error) throw error
    console.log(`Created SUPER_ADMIN: ${email}`)
    return
  }

  const { data: existingAgency } = await db
    .from("Agency")
    .select("id, name, slug")
    .eq("slug", agencySlug)
    .maybeSingle()

  let agencyId: string
  if (existingAgency) {
    agencyId = existingAgency.id as string
    console.log(`Using existing agency: ${existingAgency.name} (${existingAgency.slug})`)
  } else {
    const { data: created, error } = await db
      .from("Agency")
      .insert({
        name: agencyName,
        slug: agencySlug,
        planTier: "BETA",
        commissionDefault: 20,
        invoicingModel: InvoicingModels.SELF_BILLING,
        vatRegistered: false,
        active: true,
      })
      .select("id")
      .single()
    if (error || !created) throw error ?? new Error("Agency create failed")
    agencyId = created.id as string
    console.log(`Created agency: ${agencyName} (${agencySlug})`)
  }

  const { error: userErr } = await db.from("User").insert({
    email,
    name,
    role,
    active: true,
    agencyId,
    passwordHash: null,
  })
  if (userErr) throw userErr

  console.log(
    `Created ${role}: ${email} — log in with any password until you set passwordHash.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
