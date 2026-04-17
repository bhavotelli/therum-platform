/**
 * NextAuth signs JWTs with this. Set NEXTAUTH_SECRET in all deployed environments.
 * AUTH_SECRET is accepted as an alias (used by some hosts / docs).
 */
export function getAuthSecret(): string | undefined {
  const s = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim()
  return s || undefined
}
