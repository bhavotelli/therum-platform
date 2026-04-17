import "dotenv/config"

/**
 * Delete a User row by email (sessions/tokens cascade; other FKs may block — see error).
 *
 *   DELETE_EMAIL="wrong@example.com" npx tsx scripts/delete-user-by-email.ts
 */

import prisma from "../src/lib/prisma"

async function main() {
  const email = process.env.DELETE_EMAIL?.trim() || process.argv[2]?.trim()
  if (!email) {
    console.error("Usage: DELETE_EMAIL=\"user@example.com\" npx tsx scripts/delete-user-by-email.ts")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.log(`No user found with email: ${email}`)
    await prisma.$disconnect()
    return
  }

  await prisma.user.delete({ where: { id: user.id } })
  console.log(`Deleted user: ${email} (role=${user.role})`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
