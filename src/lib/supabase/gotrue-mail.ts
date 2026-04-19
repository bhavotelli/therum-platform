import { createClient } from '@supabase/supabase-js'

import { getPublicAppOrigin } from '@/lib/app-url'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

/** Invite / magic links: GoTrue redirects here with session in URL (implicit) or code (PKCE). */
export function getAuthCallbackUrl(nextPath: string): string {
  const origin = getPublicAppOrigin()
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`
}

/** Password recovery: canonical route (same styling as login). Legacy `/auth/recovery` redirects here. */
export function getAuthRecoveryUrl(): string {
  return `${getPublicAppOrigin()}/reset-password`
}

function defaultHomeForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin'
    case 'AGENCY_ADMIN':
      return '/agency/pipeline'
    case 'AGENT':
      return '/agency/dashboard'
    case 'FINANCE':
      return '/finance/invoices'
    case 'TALENT':
      return '/talent/dashboard'
    default:
      return '/agency/pipeline'
  }
}

export function getInviteRedirectForRole(role: string): string {
  return getAuthCallbackUrl(defaultHomeForRole(role))
}

/** Password reset email: user lands on `/reset-password` then `establish-session` with `next` for their portal. */
export function getRecoveryRedirectForRole(role: string): string {
  const next = defaultHomeForRole(role)
  return `${getAuthRecoveryUrl()}?next=${encodeURIComponent(next)}`
}

/**
 * Sends Supabase's invite email and creates the Auth user in invited state. Returns `auth.users` id.
 */
export async function inviteUserByGoTrue(email: string, redirectTo: string): Promise<string> {
  const supabase = getSupabaseServiceRole()
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) throw error
  if (!data.user?.id) throw new Error('Supabase invite did not return a user id.')
  return data.user.id
}

/**
 * Sends Supabase's password-recovery email (`/recover`). Uses anon + implicit flow so PKCE verifier is not required server-side.
 */
export async function sendPasswordRecoveryEmailViaGoTrue(email: string, redirectTo: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for recovery email.')
  }
  const supabase = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      flowType: 'implicit',
    },
  })
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

/**
 * Same recovery email as {@link sendPasswordRecoveryEmailViaGoTrue}; use when invite cannot be re-sent (e.g. already confirmed).
 */
export async function sendMagicLinkStyleRecovery(email: string, redirectTo: string): Promise<void> {
  await sendPasswordRecoveryEmailViaGoTrue(email, redirectTo)
}
