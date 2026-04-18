import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseImpersonationCookie } from '@/lib/impersonation'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'

export type FinanceSessionContext = {
  userId: string
  agencyId: string
  impersonatingReadOnly: boolean
}

export type FinancePageContextResult =
  | { status: 'ok'; userId: string; agencyId: string; impersonatingReadOnly: boolean }
  | { status: 'need_login' }
  | { status: 'need_agency' }
  | { status: 'need_impersonation' }

/**
 * Resolves tenant scope for /finance routes. FINANCE users use user.agencyId;
 * SUPER_ADMIN uses the `therum_impersonation` cookie (same read-only session as /agency).
 */
export async function resolveFinancePageContext(): Promise<FinancePageContextResult> {
  const appUser = await resolveAppUser()
  const userId = appUser?.id
  if (!appUser || !userId) {
    return { status: 'need_login' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true, role: true, active: true },
  })

  if (!user?.active) {
    return { status: 'need_login' }
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    const impersonation = parseImpersonationCookie((await cookies()).get('therum_impersonation')?.value)
    if (impersonation?.agencyId) {
      return {
        status: 'ok',
        userId,
        agencyId: impersonation.agencyId,
        impersonatingReadOnly: Boolean(impersonation.readOnly),
      }
    }
    return { status: 'need_impersonation' }
  }

  if (user.role !== UserRole.FINANCE) {
    return { status: 'need_login' }
  }
  if (!user.agencyId) {
    return { status: 'need_agency' }
  }

  return { status: 'ok', userId, agencyId: user.agencyId, impersonatingReadOnly: false }
}

/** Route handlers (e.g. export URLs) — FINANCE users or SUPER_ADMIN with impersonation cookie. */
export async function getFinanceAgencyIdForUser(userId: string | undefined): Promise<string | null> {
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true, role: true, active: true },
  })
  if (!user?.active) return null

  if (user.role === UserRole.SUPER_ADMIN) {
    const impersonation = parseImpersonationCookie((await cookies()).get('therum_impersonation')?.value)
    return impersonation?.agencyId ?? null
  }

  if (user.role !== UserRole.FINANCE || !user.agencyId) {
    return null
  }
  return user.agencyId
}

export async function requireFinanceUserContext(options?: { requireWriteAccess?: boolean }): Promise<FinanceSessionContext> {
  const result = await resolveFinancePageContext()
  if (result.status === 'need_login') {
    redirect('/login')
  }
  if (result.status === 'need_impersonation') {
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'),
    )
  }
  if (result.status === 'need_agency') {
    throw new Error('No agency linked to this user')
  }

  if (options?.requireWriteAccess && result.impersonatingReadOnly) {
    throw new Error(
      'Read-only support view is active. Switch back to a finance user or end impersonation to make changes.',
    )
  }

  return {
    userId: result.userId,
    agencyId: result.agencyId,
    impersonatingReadOnly: result.impersonatingReadOnly,
  }
}

export async function requireFinanceAgencyId(options?: { requireWriteAccess?: boolean }): Promise<string> {
  const { agencyId } = await requireFinanceUserContext(options)
  return agencyId
}

/** Ensures an invoice triplet belongs to the tenant (deal.agencyId). Use in finance server actions before mutating by id. */
export async function assertInvoiceTripletInAgency(tripletId: string, agencyId: string): Promise<void> {
  const row = await prisma.invoiceTriplet.findFirst({
    where: {
      id: tripletId,
      milestone: { deal: { agencyId } },
    },
    select: { id: true },
  })
  if (!row) {
    throw new Error('Invoice not found or not in your agency')
  }
}
