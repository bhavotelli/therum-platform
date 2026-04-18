import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

const talentLoginDisabledForBeta =
  process.env.THERUM_BETA_PREVIEW_ONLY === 'true' ||
  process.env.NEXT_PUBLIC_THERUM_BETA_PREVIEW_ONLY === 'true'

export type ResolvedAppUser = {
  id: string
  email: string
  name: string
  role: UserRole
  agencyId: string | null
  talentId: string | null
  active: boolean
  authUserId: string | null
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  agencyId: true,
  talentId: true,
  active: true,
  authUserId: true,
} as const

/**
 * Given a Supabase Auth user, resolve the app `User` row (authUserId first, then email link + backfill).
 */
export async function resolveAppUserFromSupabaseAuth(authUser: User): Promise<ResolvedAppUser | null> {
  if (!authUser.id) return null

  let row = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    select: userSelect,
  })

  if (!row && authUser.email) {
    const email = authUser.email.trim().toLowerCase()
    row = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: userSelect,
    })
    if (row && !row.authUserId) {
      await prisma.user.update({
        where: { id: row.id },
        data: { authUserId: authUser.id },
      })
      row = { ...row, authUserId: authUser.id }
    }
  }

  if (!row?.active) {
    return null
  }

  if (talentLoginDisabledForBeta && row.role === UserRole.TALENT) {
    return null
  }

  if (row.role !== UserRole.SUPER_ADMIN && row.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: row.agencyId },
      select: { active: true },
    })
    if (agency && !agency.active) {
      return null
    }
  }

  return row
}

/** For API responses when resolveAppUserFromSupabaseAuth returns null — explains *why* for support. */
export async function describeAppUserLinkFailure(authUser: User): Promise<{ code: string; message: string }> {
  const email = authUser.email?.trim().toLowerCase()
  if (!email) {
    return {
      code: 'NO_EMAIL',
      message: 'Your login has no email on file. Contact support.',
    }
  }

  const byAuth = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    select: { id: true, active: true, role: true, agencyId: true },
  })
  const byEmail =
    byAuth ??
    (await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, active: true, role: true, agencyId: true },
    }))

  if (!byEmail) {
    return {
      code: 'NOT_IN_APP_DB',
      message:
        'Supabase accepted your password, but there is no matching user in the app database. Often DATABASE_URL points at a different Supabase project than NEXT_PUBLIC_SUPABASE_URL, or this user was never provisioned.',
    }
  }
  if (!byEmail.active) {
    return { code: 'USER_INACTIVE', message: 'This Therum account is disabled.' }
  }
  if (talentLoginDisabledForBeta && byEmail.role === UserRole.TALENT) {
    return {
      code: 'TALENT_BETA',
      message: 'Talent login is disabled in beta. Use preview links from your agency or turn off THERUM_BETA_PREVIEW_ONLY.',
    }
  }
  if (byEmail.role !== UserRole.SUPER_ADMIN && byEmail.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: byEmail.agencyId },
      select: { active: true },
    })
    if (agency && !agency.active) {
      return { code: 'AGENCY_INACTIVE', message: 'Your agency is inactive.' }
    }
  }
  return {
    code: 'UNKNOWN',
    message: 'Could not link this login to Therum. Try again or contact support.',
  }
}

/**
 * Current app user from Supabase session + Prisma (fail closed).
 */
export async function resolveAppUser(): Promise<ResolvedAppUser | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }
  return resolveAppUserFromSupabaseAuth(user)
}
