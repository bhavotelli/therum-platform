'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Logo } from '@/components/layout/Logo'
import { createSupabaseImplicitClient } from '@/lib/supabase/client'

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  AGENCY_ADMIN: '/agency/pipeline',
  AGENT: '/agency/dashboard',
  FINANCE: '/finance/invoices',
  TALENT: '/talent/dashboard',
}

export function PasswordResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get('next') ?? '/agency/pipeline'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/agency/pipeline'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting'>('loading')
  const [hint, setHint] = useState('Choose a new password for your Therum account.')

  useEffect(() => {
    const supabase = createSupabaseImplicitClient()

    const trySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session
    }

    let cancelled = false

    void (async () => {
      let session = await trySession()
      if (!session) {
        await new Promise((r) => setTimeout(r, 150))
        session = await trySession()
      }
      if (!session) {
        await new Promise((r) => setTimeout(r, 400))
        session = await trySession()
      }
      if (cancelled) return
      if (!session) {
        setStatus('ready')
        setHint(
          "No active reset session. Open the latest password reset link from your email on this device. If this keeps happening, confirm Supabase Authentication redirect URLs include this site's /reset-password, then request a new reset.",
        )
        return
      }
      setStatus('ready')
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) {
        setStatus('ready')
        setHint('Choose a new password for your Therum account.')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setStatus('submitting')
    const supabase = createSupabaseImplicitClient()
    const { error: upErr } = await supabase.auth.updateUser({ password })
    if (upErr) {
      setError(upErr.message)
      setStatus('ready')
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token || !session.refresh_token) {
      setError('Session lost after update. Try signing in again.')
      setStatus('ready')
      return
    }

    const est = await fetch('/api/auth/establish-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        next,
      }),
    })

    if (!est.ok) {
      let msg = 'Could not complete sign-in.'
      try {
        const body = (await est.json()) as { message?: string }
        if (typeof body?.message === 'string') msg = body.message
      } catch {
        /* ignore */
      }
      setError(msg)
      setStatus('ready')
      return
    }

    const me = await fetch('/api/auth/me', { credentials: 'include' })
    const payload = me.ok ? await me.json() : null
    const role = payload?.user?.role as string | undefined
    const home = role ? ROLE_HOME[role] ?? next : next
    router.push(home)
    router.refresh()
  }

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
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500 opacity-90" />

          <div className="mb-8 text-center space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Reset your password
            </h1>
            <p className="text-sm text-zinc-500">{hint}</p>
          </div>

          {error ? (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold">
              {error}
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="new-password"
                className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={status === 'loading' || status === 'submitting'}
                autoComplete="new-password"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-black text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all outline-none shadow-inner"
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                disabled={status === 'loading' || status === 'submitting'}
                autoComplete="new-password"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-black text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all outline-none shadow-inner"
                placeholder="Repeat password"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || status === 'submitting'}
              className="w-full flex justify-center items-center py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-500 active:scale-[0.98] transition-all shadow-xl shadow-amber-900/20 disabled:opacity-50"
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
                  Saving…
                </span>
              ) : (
                'Save and continue'
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
