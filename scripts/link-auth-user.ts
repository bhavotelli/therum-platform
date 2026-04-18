/**
 * Link a Prisma User to a Supabase Auth user by UUID and optionally fix email.
 *
 * Usage:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/link-auth-user.ts <auth-uuid> <prisma-user-email-current> [new-email]
 *
 * Example:
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/link-auth-user.ts \
 *     9efaf7c3-a83d-4dd1-b353-f615cbe67769 bhavik@therum.co bhavik@therum.com
 */
import './load-env'
import prisma from '../src/lib/prisma'

async function main() {
  const authId = process.argv[2]
  const currentEmail = process.argv[3]
  const newEmail = process.argv[4]

  if (!authId || !currentEmail) {
    console.error(
      'Usage: …/tsx scripts/link-auth-user.ts <auth-uuid> <prisma-user-email> [new-email]',
    )
    process.exit(1)
  }

  const row = await prisma.user.findFirst({
    where: { email: { equals: currentEmail, mode: 'insensitive' } },
    select: { id: true, email: true, authUserId: true },
  })
  if (!row) {
    console.error(`No User found with email matching: ${currentEmail}`)
    process.exit(1)
  }

  const data: { authUserId: string; email?: string } = { authUserId: authId }
  if (newEmail) {
    data.email = newEmail.trim().toLowerCase()
  }

  const updated = await prisma.user.update({
    where: { id: row.id },
    data,
    select: { email: true, authUserId: true, role: true },
  })

  console.log('Updated:', updated)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
