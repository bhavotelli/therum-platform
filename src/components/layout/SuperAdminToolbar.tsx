import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseImpersonationCookie } from '@/lib/impersonation'
import SuperAdminToolbarClient from '@/components/layout/SuperAdminToolbarClient'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'

export default async function SuperAdminToolbar() {
  const appUser = await resolveAppUser()
  const role = appUser?.role
  if (role !== UserRole.SUPER_ADMIN) {
    return null
  }

  const [agencies, impCookie] = await Promise.all([
    prisma.agency.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, active: true },
    }),
    (await cookies()).get('therum_impersonation')?.value,
  ])

  const currentAgencyId = parseImpersonationCookie(impCookie)?.agencyId ?? ''

  return <SuperAdminToolbarClient agencies={agencies} currentAgencyId={currentAgencyId} />
}
