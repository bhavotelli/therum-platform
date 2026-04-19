'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { createSupabaseImplicitClient } from '@/lib/supabase/client'

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  AGENCY_ADMIN: '/agency/pipeline',
  AGENT: '/agency/dashboard',
  FINANCE: '/finance/invoices',
  TALENT: '/talent/dashboard',
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get('next') ?? '/agency/pipeline'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/agency/pipeline'
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    const supabase = createSupabaseImplicitClient()

    let cancelled = false

    async function finish() {
      const trySession = async () => {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) return { session: null as typeof session, error }
        return { session, error: null as null }
      }

      // Allow GoTrue to process hash / query on first tick
      let { session, error } = await trySession()
      if (!session) {
        await new Promise((r) => setTimeout(r, 150))
        ;({ session, error } = await trySession())
      }
      if (!session) {
        await new Promise((r) => setTimeout(r, 400))
        ;({ session, error } = await trySession())
      }

      if (cancelled) return
      if (error) {
        setMessage(error.message)
        return
      }
      if (!session) {
        setMessage('No session from this link. Open the latest email from Therum or request a new invite.')
        return
      }

      const access_token = session.access_token
      const refresh_token = session.refresh_token
      const est = await fetch('/api/auth/establish-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token, refresh_token, next }),
      })

      if (!est.ok) {
        let msg = 'Could not complete sign-in.'
        try {
          const body = (await est.json()) as { message?: string }
          if (typeof body?.message === 'string') msg = body.message
        } catch {
          /* ignore */
        }
        setMessage(msg)
        return
      }

      const me = await fetch('/api/auth/me', { credentials: 'include' })
      const payload = me.ok ? await me.json() : null
      const role = payload?.user?.role as string | undefined
      const home = role ? ROLE_HOME[role] ?? next : next
      router.push(home)
      router.refresh()
    }

    void finish()

    return () => {
      cancelled = true
    }
  }, [next, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D1526] p-6 text-center text-sm text-zinc-300">
      {message}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0D1526] text-zinc-300">Loading…</div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
