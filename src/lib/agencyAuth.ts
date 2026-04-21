import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { parseImpersonationCookie } from '@/lib/impersonation'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { UserRole } from '@/types/database'
import { UserRoles } from '@/types/database'

export type AgencySessionContext = {
  userId: string
  role: UserRole
  agencyId: string
  impersonatingReadOnly: boolean
}

export type AgencyPageContextResult =
  | {
      status: 'ok'
      userId: string
      role: UserRole
      agencyId: string
      impersonatingReadOnly: boolean
    }
  | { status: 'need_login' }
  | { status: 'forbidden' }
  | { status: 'no_agency' }
  | { status: 'need_impersonation' }

/**
 * Resolves tenant for /agency/* UI (AGENCY_ADMIN / AGENT by user.agencyId, SUPER_ADMIN via impersonation cookie).
 * Does not throw — use for Server Components; pair with redirect/notFound.
 */
export async function resolveAgencyPageContext(): Promise<AgencyPageContextResult> {
  const appUser = await resolveAppUser()
  const role = appUser?.role ?? null
  const userId = appUser?.id ?? null

  if (!appUser || !role || !userId) {
    return { status: 'need_login' }
  }

  const isAgencyRole = role === UserRoles.AGENCY_ADMIN || role === UserRoles.AGENT
  const isSuperAdmin = role === UserRoles.SUPER_ADMIN

  if (!isAgencyRole && !isSuperAdmin) {
    return { status: 'forbidden' }
  }

  const impersonation = parseImpersonationCookie((await cookies()).get('therum_impersonation')?.value)
  const impersonatingReadOnly = Boolean(impersonation?.readOnly)

  if (isAgencyRole) {
    const db = getSupabaseServiceRole()
    const { data: user, error } = await db.from('User').select('agencyId').eq('id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!user?.agencyId) {
      return { status: 'no_agency' }
    }
    return {
      status: 'ok',
      userId,
      role,
      agencyId: user.agencyId,
      impersonatingReadOnly,
    }
  }

  if (!impersonation?.agencyId) {
    return { status: 'need_impersonation' }
  }

  return {
    status: 'ok',
    userId,
    role,
    agencyId: impersonation.agencyId,
    impersonatingReadOnly,
  }
}

export async function getAgencySessionContext(options?: { requireWriteAccess?: boolean }): Promise<AgencySessionContext> {
  const r = await resolveAgencyPageContext()
  if (r.status === 'need_login' || r.status === 'forbidden') {
    throw new Error('Unauthorized')
  }
  if (r.status === 'no_agency') {
    throw new Error('No agency linked to current user.')
  }
  if (r.status === 'need_impersonation') {
    throw new Error('No impersonation context found for super admin.')
  }

  if (options?.requireWriteAccess && r.impersonatingReadOnly) {
    // Expected-state guard for super admins in read-only impersonation. Throwing
    // an Error propagates through RSC as an uncaught exception and spams Sentry
    // (THE-61); redirect() emits a NEXT_REDIRECT digest instead, which the
    // framework and Sentry Next.js integration both treat as a non-error.
    // The admin page renders the notice as a banner and is the correct place
    // for the super admin to end impersonation before retrying.
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Read-only impersonation is active. End impersonation or switch to write mode to make changes.'),
    )
  }

  return {
    userId: r.userId,
    role: r.role,
    agencyId: r.agencyId,
    impersonatingReadOnly: r.impersonatingReadOnly,
  }
}
