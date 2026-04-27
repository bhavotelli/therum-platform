'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Logo } from '@/components/layout/Logo'
import { createSupabaseImplicitClient } from '@/lib/supabase/client'

const COOLDOWN_SECONDS = 60

function isRateLimitError(err: { message?: string; status?: number; code?: string } | null | undefined) {
  if (!err) return false
  if (err.status === 429) return true
  const msg = (err.message ?? '').toLowerCase()
  const code = (err.code ?? '').toLowerCase()
  return (
    code.includes('rate_limit') ||
    code === 'over_email_send_rate_limit' ||
    msg.includes('rate limit') ||
    msg.includes('too many')
  )
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cooldown > 0 || status === 'submitting') return
    setError('')

    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      setStatus('error')
      return
    }

    setStatus('submitting')
    // Implicit flow (hash tokens) so the email link matches what
    // /reset-password's PasswordResetForm expects. createSupabaseBrowserClient
    // hard-codes PKCE, which would produce a ?code= link the receiving page
    // can't read — leading to "Auth session missing!" on updateUser.
    const supabase = createSupabaseImplicitClient()
    const redirectTo = `${window.location.origin}/reset-password`
    const { error: rpErr } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })

    if (rpErr) {
      console.error('[forgot-password]', rpErr)
      if (isRateLimitError(rpErr)) {
        setError(
          "We've sent too many reset emails recently. Please wait a few minutes before requesting another.",
        )
        setStatus('error')
        setCooldown(COOLDOWN_SECONDS)
        return
      }
      setError(rpErr.message || 'Something went wrong. Please try again.')
      setStatus('error')
      return
    }

    setStatus('sent')
    setCooldown(COOLDOWN_SECONDS)
  }

  const disabled = status === 'submitting' || cooldown > 0
  const buttonLabel =
    status === 'submitting'
      ? 'Sending…'
      : cooldown > 0
        ? `Try again in ${cooldown}s`
        : status === 'sent'
          ? 'Resend reset link'
          : 'Send reset link'

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,85,204,0.15),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.03] text-black"
          style={{
            backgroundImage: 'radial-gradient(currentColor 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <Logo className="text-5xl text-zinc-900 drop-shadow-sm" />
          </div>
          <p className="mt-3 text-center text-xs font-bold text-indigo-900/60 uppercase tracking-[0.4em]">
            Financial Operating System
          </p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90" />

          <div className="mb-8 text-center space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Forgot your password?</h1>
            <p className="text-sm text-zinc-500">
              Enter the email associated with your Therum account and we&apos;ll send you a link to reset it.
            </p>
          </div>

          {status === 'sent' ? (
            <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-lg text-sm font-semibold">
              Reset link sent. Check your inbox (and spam folder).
            </div>
          ) : null}

          {error ? (
            <div
              id="forgot-password-error"
              role="alert"
              className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold"
            >
              {error}
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={onSubmit} autoComplete="on">
            <div className="space-y-2" suppressHydrationWarning>
              <label
                htmlFor="email"
                className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1"
              >
                Email Platform ID
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'submitting'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'forgot-password-error' : undefined}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-black text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none shadow-inner disabled:opacity-60"
                placeholder="name@agency.com"
              />
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="w-full flex justify-center items-center py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
            >
              {status === 'submitting' ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending…
                </span>
              ) : (
                buttonLabel
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Remember your password?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
