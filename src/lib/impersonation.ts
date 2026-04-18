export type ImpersonationCookie = {
  sessionId: string
  agencyId: string
  adminUserId: string
  readOnly: boolean
  startedAt: string
}

export function parseImpersonationCookie(value: string | undefined): ImpersonationCookie | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ImpersonationCookie>
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.agencyId !== 'string' ||
      typeof parsed.adminUserId !== 'string' ||
      typeof parsed.readOnly !== 'boolean' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null
    }
    return parsed as ImpersonationCookie
  } catch {
    return null
  }
}
