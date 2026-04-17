import "dotenv/config"

/**
 * Create a single Agency + User for production without running the full seed.
 *
 * First time on a new database — create tables:
 *   DATABASE_URL="postgresql://..." npx prisma migrate deploy
 *
 * Super Admin (no agency row — use /admin to invite others):
 *   DATABASE_URL="postgresql://..." PROVISION_EMAIL="you@company.com" PROVISION_NAME="Your Name" \\
 *     npx tsx scripts/provision-minimal-user.ts --super-admin
 *
 * Agency user (finance, agent, etc.):
 *   PROVISION_ROLE=FINANCE PROVISION_EMAIL=... AGENCY_NAME="..." AGENCY_SLUG="..." \\
 *     npx tsx scripts/provision-minimal-user.ts
 *
 * Env:
 *   PROVISION_EMAIL   (required)
 *   PROVISION_NAME    (optional)
 *   PROVISION_ROLE    FINANCE | AGENCY_ADMIN | AGENT | SUPER_ADMIN (ignored if --super-admin)
 *   AGENCY_NAME, AGENCY_SLUG  (for non–super-admin)
 *
 * Password: passwordHash unset → any password works until you set a real hash via the app.
 */

import { Prisma, UserRole, PlanTier, InvoicingModel } from "@prisma/client"
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
  const role = superAdminCli ? UserRole.SUPER_ADMIN : parseRole(process.env.PROVISION_ROLE)
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
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    console.error(`
The database has no Prisma tables yet. Apply migrations against this DATABASE_URL, then re-run:

  npx prisma migrate deploy

`)
  }
  console.error(e)
  process.exit(1)
})
