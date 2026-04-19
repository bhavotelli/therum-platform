'use client'

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Invite and recovery links from Supabase Auth often return implicit tokens in the URL **hash**.
 * `createBrowserClient` hard-codes PKCE — use this for `/auth/callback` and `/reset-password` after email links.
 */
export function createSupabaseImplicitClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
