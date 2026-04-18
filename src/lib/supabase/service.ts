import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Singleton Supabase client using the **service role** key.
 * **Server-only** — never import from client components or expose to the browser.
 * Bypasses RLS; caller must enforce tenant/auth rules (same trust model as Prisma + `pg`).
 *
 * Typed loosely (`SupabaseClient`) so `.from('User')` etc. match Prisma’s PascalCase tables without fighting PostgREST generics.
 */
let serviceSingleton: SupabaseClient | null = null

export function getSupabaseServiceRole(): SupabaseClient {
  if (serviceSingleton) return serviceSingleton

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) {
    throw new Error('Supabase service role is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).')
  }

  serviceSingleton = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return serviceSingleton
}

/** Use in tests or scripts to reset the client after env changes. */
export function resetSupabaseServiceRoleSingletonForTests(): void {
  serviceSingleton = null
}
