import { redirect } from 'next/navigation'

import { formatActionError, rethrowIfRedirectError } from '@/lib/errors'
import { ensureSupabaseAuthUser, setSupabaseAuthPasswordById } from '@/lib/supabase/admin'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

type SetPasswordPageProps = {
  searchParams?: Promise<{ token?: string; type?: string; notice?: string; error?: string }>
}

async function completeSetPassword(formData: FormData) {
  'use server'

  const token = String(formData.get('token') ?? '')
  const type = String(formData.get('type') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!token || (type !== 'invite' && type !== 'reset')) {
    redirect('/auth/set-password?error=Invalid link.')
  }
  if (!password || password.length < 6) {
    redirect(
      `/auth/set-password?${new URLSearchParams({
        type,
        token,
        error: 'Password must be at least 6 characters.',
      }).toString()}`,
    )
  }
  if (password !== confirmPassword) {
    redirect(
      `/auth/set-password?${new URLSearchParams({
        type,
        token,
        error: 'Passwords do not match.',
      }).toString()}`,
    )
  }

  try {
    const db = getSupabaseServiceRole()

    if (type === 'invite') {
      const now = new Date().toISOString()
      const { data: user, error: uErr } = await db
        .from('User')
        .select('id, email, authUserId')
        .eq('inviteToken', token)
        .gt('inviteExpiry', now)
        .maybeSingle()

      if (uErr) throw uErr

      if (!user) {
        redirect('/auth/set-password?error=Invite link is invalid or expired.')
      }

      const authUserId = user.authUserId ?? (await ensureSupabaseAuthUser(user.email))
      await setSupabaseAuthPasswordById(authUserId, password)

      const { error: upErr } = await db
        .from('User')
        .update({
          authUserId,
          active: true,
          inviteToken: null,
          inviteExpiry: null,
          lastLoginAt: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (upErr) throw upErr
    }

    if (type === 'reset') {
      const { data: reset, error: rErr } = await db
        .from('ResetToken')
        .select('id, userId, expiresAt')
        .eq('token', token)
        .maybeSingle()
      if (rErr) throw rErr

      if (!reset || new Date(reset.expiresAt) <= new Date()) {
        redirect('/auth/set-password?error=Reset link is invalid or expired.')
      }

      const { data: userRow, error: usrErr } = await db
        .from('User')
        .select('email, authUserId')
        .eq('id', reset.userId)
        .maybeSingle()
      if (usrErr) throw usrErr
      if (!userRow) {
        redirect('/auth/set-password?error=Reset link is invalid or expired.')
      }

      const authUserId = userRow.authUserId ?? (await ensureSupabaseAuthUser(userRow.email))
      await setSupabaseAuthPasswordById(authUserId, password)

      const { error: upErr } = await db
        .from('User')
        .update({
          authUserId,
          active: true,
          lastLoginAt: new Date().toISOString(),
        })
        .eq('id', reset.userId)
      if (upErr) throw upErr

      const { error: delErr } = await db.from('ResetToken').delete().eq('id', reset.id)
      if (delErr) throw delErr
    }

    redirect('/login?notice=Password set successfully. You can now sign in.')
  } catch (error) {
    rethrowIfRedirectError(error)
    const msg = formatActionError(error, 'Could not save your password. Try again.')
    redirect(`/auth/set-password?${new URLSearchParams({ type, token, error: msg }).toString()}`)
  }
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const params = searchParams ? await searchParams : undefined
  const token = params?.token ?? ''
  const type = params?.type ?? ''
  const notice = params?.notice
  const error = params?.error

  return (
    <div className="min-h-screen bg-[#0D1526] text-white p-6 font-sans flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
        <h1 className="text-xl font-bold">Set Password</h1>
        <p className="text-sm text-zinc-400">
          {type === 'invite'
            ? 'Complete your invite setup.'
            : type === 'reset'
              ? 'Set a new password for your account.'
              : 'Use a valid password link.'}
        </p>

        {notice && <div className="rounded border border-emerald-300/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">{notice}</div>}
        {error && <div className="rounded border border-red-300/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</div>}

        <form action={completeSetPassword} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="type" value={type} />
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm"
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            required
            className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold">
            Save Password
          </button>
        </form>
      </div>
    </div>
  )
}
