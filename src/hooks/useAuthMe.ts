'use client'

import { useEffect, useState } from 'react'

export type AuthMeUser = {
  id: string
  email: string
  name: string
  role: string
  agencyId: string | null
  talentId: string | null
}

/** `undefined` = loading */
export function useAuthMe(): AuthMeUser | null | undefined {
  const [user, setUser] = useState<AuthMeUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setUser(d?.user ?? null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return user
}
