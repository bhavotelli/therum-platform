/**
 * Resolves Postgres URL for Prisma. Vercel’s Supabase integration injects
 * `POSTGRES_PRISMA_URL`; this app traditionally uses `DATABASE_URL`.
 *
 * Supabase transaction pooler (port 6543) requires `pgbouncer=true` for Prisma
 * (Supavisor / prepared statements). Integration strings sometimes omit it.
 */
export function normalizeSupabasePoolerUrl(connectionString: string): string {
  const trimmed = connectionString.trim()
  if (!trimmed) return trimmed

  try {
    const u = new URL(trimmed)
    const host = u.hostname
    const port = u.port || '5432'

    const isSupabaseTransactionPooler =
      host.includes('pooler.supabase.com') && port === '6543'

    if (!isSupabaseTransactionPooler) {
      return trimmed
    }

    const params = u.searchParams
    if (!params.has('pgbouncer')) {
      params.set('pgbouncer', 'true')
    }
    if (!params.has('connection_limit')) {
      params.set('connection_limit', '1')
    }
    if (!params.has('connect_timeout')) {
      params.set('connect_timeout', '30')
    }

    return u.toString()
  } catch {
    return trimmed
  }
}

/**
 * Same resolution as runtime but returns undefined when unset (for `prisma.config` during `generate`).
 */
export function getDatabaseUrlOptional(): string | undefined {
  const raw =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim()
  if (!raw) return undefined
  return normalizeSupabasePoolerUrl(raw)
}

export function getDatabaseUrl(): string {
  const url = getDatabaseUrlOptional()
  if (!url) {
    throw new Error(
      'Set DATABASE_URL, or rely on Vercel Supabase integration vars POSTGRES_PRISMA_URL / POSTGRES_URL.',
    )
  }
  return url
}
