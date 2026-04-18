/**
 * Resolves Postgres URL for Prisma. Vercel’s Supabase integration injects
 * `POSTGRES_PRISMA_URL`; this app traditionally uses `DATABASE_URL`.
 */
export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    ''
  if (!url) {
    throw new Error(
      'Set DATABASE_URL, or rely on Vercel Supabase integration vars POSTGRES_PRISMA_URL / POSTGRES_URL.',
    )
  }
  return url
}
