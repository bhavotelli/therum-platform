/**
 * Resolves Postgres URL for Prisma. Vercel’s Supabase integration injects
 * `POSTGRES_PRISMA_URL`; older `DATABASE_URL` values may point at a different DB.
 *
 * Supabase transaction pooler (port 6543) needs `pgbouncer=true` for Prisma + Supavisor.
 * We append params without parsing the full URL so special characters in passwords stay intact.
 */

/** Prefer integration pooler URL first so it wins over a stale manual DATABASE_URL on Vercel. */
export function getDatabaseUrlOptional(): string | undefined {
  const raw =
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_PRISMA_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_POSTGRES_URL?.trim() ||
    ''
  if (!raw) return undefined
  return normalizeSupabasePoolerUrl(raw)
}

export function normalizeSupabasePoolerUrl(connectionString: string): string {
  const trimmed = connectionString.trim()
  if (!trimmed) return trimmed

  const lowered = trimmed.toLowerCase()
  const isSupabaseTransactionPooler =
    lowered.includes('pooler.supabase.com') && /[:/]6543([/?]|$)/.test(trimmed)

  if (!isSupabaseTransactionPooler) {
    return trimmed
  }

  if (/[?&]pgbouncer=/i.test(trimmed)) {
    return trimmed
  }

  const sep = trimmed.includes('?') ? '&' : '?'
  return `${trimmed}${sep}pgbouncer=true&connection_limit=1&connect_timeout=30`
}

export function getDatabaseUrl(): string {
  const url = getDatabaseUrlOptional()
  if (!url) {
    throw new Error(
      'Set DATABASE_URL, POSTGRES_PRISMA_URL, or other Vercel/Supabase database env vars.',
    )
  }
  return url
}
