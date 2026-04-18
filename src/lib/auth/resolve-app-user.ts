import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

const talentLoginDisabledForBeta = process.env.THERUM_BETA_PREVIEW_ONLY === 'true'

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
