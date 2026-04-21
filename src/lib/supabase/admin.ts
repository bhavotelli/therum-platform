import * as Sentry from '@sentry/nextjs'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

import { getSupabaseServiceRole } from '@/lib/supabase/service'

function getSupabaseAdminClient() {
  return getSupabaseServiceRole()
}

async function findAuthUserByEmail(email: string): Promise<SupabaseAuthUser | null> {
  const supabase = getSupabaseAdminClient()
  const normalized = email.trim().toLowerCase()
  let page = 1

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Supabase list users failed: ${error.message}`)
    const users = data.users ?? []
    const match = users.find((u) => (u.email ?? '').trim().toLowerCase() === normalized) ?? null
    if (match) return match
    if (users.length < 1000) return null
    page += 1
  }
}

/**
 * Ensure a Supabase auth user exists for an app email, returning auth.users.id.
 */
export async function ensureSupabaseAuthUser(email: string): Promise<string> {
  const existing = await findAuthUserByEmail(email)
  if (existing?.id) return existing.id

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (error) {
    // If another process created it concurrently, resolve by email one more time.
    const recovered = await findAuthUserByEmail(email)
    if (recovered?.id) return recovered.id
    throw new Error(`Failed to provision Supabase auth user: ${error.message}`)
  }
  if (!data.user?.id) {
    throw new Error('Supabase did not return created auth user id.')
  }
  return data.user.id
}

export async function setSupabaseAuthPasswordById(authUserId: string, password: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to update Supabase password: ${error.message}`)
}

/**
 * Rollback helper for flows that invite an auth user before the DB commit.
 *
 * Does NOT re-raise on failure: the caller needs to surface the original
 * DB error to the user, so masking it with a rollback-path error would be
 * wrong. Instead, on failure we capture to Sentry with fingerprinting so
 * ops get a page-able alert with the orphan authUserId — that is the
 * reconciliation signal that replaces a manual cleanup cron.
 */
export async function deleteSupabaseAuthUserById(authUserId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(authUserId)
  if (error) {
    console.error('[supabase/admin] rollback deleteUser failed', { authUserId, error: error.message })
    Sentry.captureException(new Error(`Orphan auth.users row: rollback deleteUser failed — ${error.message}`), {
      level: 'error',
      tags: { subsystem: 'supabase-auth', kind: 'orphan-auth-row' },
      // Include authUserId in the fingerprint so each stranded row is a
      // distinct Sentry issue that ops can track to resolution, rather
      // than collapsing all orphans into a single group.
      fingerprint: ['supabase-auth', 'orphan-rollback-failed', authUserId],
      extra: { authUserId, supabaseErrorMessage: error.message },
    })
  }
}
