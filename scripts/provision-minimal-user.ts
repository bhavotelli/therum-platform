import "dotenv/config"

/**
 * Create a single Agency + User for production without running the full seed.
 *
 * Usage (production DB):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/provision-minimal-user.ts
 *
 * Optional env:
 *   PROVISION_EMAIL=you@agency.com
 *   PROVISION_NAME="Your Name"
 *   PROVISION_ROLE=FINANCE          # FINANCE | AGENCY_ADMIN | AGENT | SUPER_ADMIN
 *   AGENCY_NAME="Your Agency"
 *   AGENCY_SLUG=your-agency       # lowercase, unique
 *
 * Password: leave passwordHash unset → any password works (same as MVP seed behaviour).
 * To set a real password later, use your app’s set-password / invite flow or update passwordHash.
 */

import { UserRole, PlanTier, InvoicingModel } from "@prisma/client"
import prisma from "../src/lib/prisma"

// TALENT is omitted: it requires a linked Talent row — create via app or full seed.
const ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENT,
  UserRole.FINANCE,
]

function parseRole(raw: string | undefined): UserRole {
  const r = (raw || "FINANCE").toUpperCase() as UserRole
  if (ROLES.includes(r)) return r
  throw new Error(`Invalid PROVISION_ROLE: ${raw}. Use one of: ${ROLES.join(", ")}`)
}

async function main() {
  const email = process.env.PROVISION_EMAIL || "finance@example.com"
  const name = process.env.PROVISION_NAME || "Finance User"
  const role = parseRole(process.env.PROVISION_ROLE)
  const agencyName = process.env.AGENCY_NAME || "My Agency"
  const agencySlug = (process.env.AGENCY_SLUG || "my-agency").toLowerCase().replace(/\s+/g, "-")

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`User already exists: ${email} (id=${existing.id})`)
    await prisma.$disconnect()
    return
  }

  if (role === UserRole.SUPER_ADMIN) {
    await prisma.user.create({
      data: {
        email,
        name,
        role: UserRole.SUPER_ADMIN,
        active: true,
        passwordHash: null,
      },
    })
    console.log(`Created SUPER_ADMIN: ${email}`)
    await prisma.$disconnect()
    return
  }

  let agency = await prisma.agency.findUnique({ where: { slug: agencySlug } })
  if (!agency) {
    agency = await prisma.agency.create({
      data: {
        name: agencyName,
        slug: agencySlug,
        planTier: PlanTier.BETA,
        commissionDefault: 20,
        invoicingModel: InvoicingModel.SELF_BILLING,
        vatRegistered: false,
        active: true,
      },
    })
    console.log(`Created agency: ${agency.name} (${agency.slug})`)
  } else {
    console.log(`Using existing agency: ${agency.name} (${agency.slug})`)
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role,
      active: true,
      agencyId: agency.id,
      passwordHash: null,
    },
  })

  console.log(`Created ${role}: ${email} — log in with any password until you set passwordHash.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
