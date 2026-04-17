import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export type AgencySessionContext = {
  userId: string
  role: UserRole
  agencyId: string
  impersonatingReadOnly: boolean
}

type ImpersonationCookie = {
  sessionId: string
  agencyId: string
  adminUserId: string
  readOnly: boolean
  startedAt: string
}

function parseImpersonationCookie(value: string | undefined): ImpersonationCookie | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ImpersonationCookie>
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.agencyId !== 'string' ||
      typeof parsed.adminUserId !== 'string' ||
      typeof parsed.readOnly !== 'boolean' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null
    }
    return parsed as ImpersonationCookie
  } catch {
    return null
  }
}

export async function getAgencySessionContext(options?: { requireWriteAccess?: boolean }): Promise<AgencySessionContext> {
  const session = await getServerSession(authOptions)
  const role = ((session?.user as { role?: UserRole } | undefined)?.role ?? null) as UserRole | null
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? null) as string | null

  if (!session || !role || !userId) {
    throw new Error('Unauthorized')
  }

  const isAgencyRole = role === UserRole.AGENCY_ADMIN || role === UserRole.AGENT
  const isSuperAdmin = role === UserRole.SUPER_ADMIN

  if (!isAgencyRole && !isSuperAdmin) {
    throw new Error('Unauthorized')
  }

  const impersonation = parseImpersonationCookie((await cookies()).get('therum_impersonation')?.value)
  const impersonatingReadOnly = Boolean(impersonation?.readOnly)

  if (options?.requireWriteAccess && impersonatingReadOnly) {
    throw new Error('Read-only impersonation mode is active. Stop impersonating to make changes.')
  }

  if (isAgencyRole) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true },
    })
    if (!user?.agencyId) {
      throw new Error('No agency linked to current user.')
    }
    return {
      userId,
      role,
      agencyId: user.agencyId,
      impersonatingReadOnly,
    }
  }

  if (!impersonation?.agencyId) {
    throw new Error('No impersonation context found for super admin.')
  }

  return {
    userId,
    role,
    agencyId: impersonation.agencyId,
    impersonatingReadOnly,
  }
}
