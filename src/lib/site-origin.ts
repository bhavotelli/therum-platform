/**
 * Public app origin when NEXTAUTH_URL / APP_BASE_URL are unset (invite links, etc.).
 * Override per environment via those env vars on Vercel or `.env` locally.
 */
export const DEFAULT_PUBLIC_APP_ORIGIN = "https://dev.therum.io" as const
