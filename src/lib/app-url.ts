import { DEFAULT_PUBLIC_APP_ORIGIN } from '@/lib/site-origin'

/**
 * Public origin for Supabase Auth `redirectTo` (invite/recovery).
 * Prefer `NEXT_PUBLIC_APP_ORIGIN` so emails always use the real user-facing host (e.g. dev.therum.io), not Vercel’s deployment host.
 */
export function getPublicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.split(',')[0]?.trim() ||
    DEFAULT_PUBLIC_APP_ORIGIN
  const withScheme = raw.startsWith('http') ? raw : `https://${raw}`
  return withScheme.replace(/\/$/, '')
}
