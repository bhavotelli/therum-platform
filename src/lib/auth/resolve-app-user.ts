import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'

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

const userColumns =
  'id, email, name, role, agencyId, talentId, active, authUserId' as const

function mapUserRow(row: {
  id: string
  email: string
  name: string
  role: string
  agencyId: string | null
  talentId: string | null
  active: boolean
  authUserId: string | null
}): ResolvedAppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    agencyId: row.agencyId,
    talentId: row.talentId,
    active: row.active,
    authUserId: row.authUserId,
  }
}

/**
 * Given a Supabase Auth user, resolve the app `User` row (authUserId first, then email link + backfill).
 */
export async function resolveAppUserFromSupabaseAuth(authUser: User): Promise<ResolvedAppUser | null> {
  if (!authUser.id) return null

  const db = getSupabaseServiceRole()

  const { data: byAuth, error: errAuth } = await db
    .from('User')
    .select(userColumns)
    .eq('authUserId', authUser.id)
    .maybeSingle()

  if (errAuth) throw new Error(errAuth.message)

  let row = byAuth ? mapUserRow(byAuth) : null

  if (!row && authUser.email) {
    const email = authUser.email.trim().toLowerCase()
    const { data: byEmail, error: errEmail } = await db
      .from('User')
      .select(userColumns)
      .ilike('email', email)
      .maybeSingle()

    if (errEmail) throw new Error(errEmail.message)

    if (byEmail) {
      row = mapUserRow(byEmail)
      if (!row.authUserId) {
        const { data: updated, error: errUp } = await db
          .from('User')
          .update({ authUserId: authUser.id })
          .eq('id', row.id)
          .select(userColumns)
          .single()
        if (errUp) throw new Error(errUp.message)
        if (updated) row = mapUserRow(updated)
      }
    }
  }

  if (!row?.active) {
    return null
  }

  if (talentLoginDisabledForBeta && row.role === 'TALENT') {
    return null
  }

  if (row.role !== 'SUPER_ADMIN' && row.agencyId) {
    const { data: agency, error: agErr } = await db
      .from('Agency')
      .select('active')
      .eq('id', row.agencyId)
      .maybeSingle()
    if (agErr) throw new Error(agErr.message)
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

  const db = getSupabaseServiceRole()

  const { data: byAuth, error: e1 } = await db
    .from('User')
    .select('id, active, role, agencyId')
    .eq('authUserId', authUser.id)
    .maybeSingle()
  if (e1) throw new Error(e1.message)

  let byEmail = byAuth
  if (!byEmail) {
    const { data: byEm, error: e2 } = await db
      .from('User')
      .select('id, active, role, agencyId')
      .ilike('email', email)
      .maybeSingle()
    if (e2) throw new Error(e2.message)
    byEmail = byEm
  }

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
  if (talentLoginDisabledForBeta && byEmail.role === 'TALENT') {
    return {
      code: 'TALENT_BETA',
      message:
        'Talent login is disabled in beta. Use preview links from your agency or turn off THERUM_BETA_PREVIEW_ONLY.',
    }
  }
  if (byEmail.role !== 'SUPER_ADMIN' && byEmail.agencyId) {
    const { data: agency, error: e3 } = await db
      .from('Agency')
      .select('active')
      .eq('id', byEmail.agencyId)
      .maybeSingle()
    if (e3) throw new Error(e3.message)
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
 * Current app user from Supabase session + app DB (fail closed).
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
