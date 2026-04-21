/** Next.js `redirect()` throws a special digest; rethrow so the redirect completes. */
export function rethrowIfRedirectError(error: unknown): void {
  if (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  ) {
    throw error
  }
}

/**
 * Supabase PostgrestError is a plain object, not an Error instance. Throwing it
 * from a server component / action serialises poorly over the RSC stream
 * (Sentry JAVASCRIPT-NEXTJS-D, see THE-33). Wrap it in a real Error while
 * keeping `code`, `details`, `hint` attached so downstream formatters
 * (e.g. {@link formatActionError}) can still render the richer message.
 */
export function wrapPostgrestError(err: {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}): Error {
  return Object.assign(new Error(err.message), {
    code: err.code,
    details: err.details,
    hint: err.hint,
  })
}

/** PostgREST errors are usually `Error`, but some paths throw plain objects; include `details`/`hint` when present. */
export function formatActionError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim()

  let message = ''
  let details = ''
  let hint = ''

  if (error instanceof Error) {
    message = error.message?.trim() ?? ''
    const ext = error as Error & { details?: unknown; hint?: unknown }
    if (typeof ext.details === 'string') details = ext.details.trim()
    if (typeof ext.hint === 'string') hint = ext.hint.trim()
  } else if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string') message = m.trim()
    const o = error as { details?: unknown; hint?: unknown }
    if (typeof o.details === 'string') details = o.details.trim()
    if (typeof o.hint === 'string') hint = o.hint.trim()
  }

  if (!message) return fallback
  const extra = [details, hint].filter(Boolean).join(' ')
  return extra ? `${message} — ${extra}` : message
}
