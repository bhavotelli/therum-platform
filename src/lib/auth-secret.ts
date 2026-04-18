/**
 * Signs the httpOnly gate cookie (role + app user id) and should match all deployed environments.
 * Legacy: was NEXTAUTH_SECRET. AUTH_SECRET is preferred.
 */
export function getAuthSecret(): string | undefined {
  const s = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim()
  return s || undefined
}
