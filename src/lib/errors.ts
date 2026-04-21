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
 * Map Postgres SQLSTATE codes to user-safe messages. Raw PostgrestError
 * strings include constraint names, column names, and sometimes row values
 * (e.g. `duplicate key value violates unique constraint "Client_email_key"`,
 * `Key (email)=(foo@bar.com) already exists`). Those must not reach the
 * client error surface.
 *
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGRES_CODE_MESSAGES: Record<string, string> = {
  '23505': 'That record already exists.',
  '23503':
    'This record cannot be deleted because other data references it, or the record it references no longer exists.',
  '23502': 'A required field was missing.',
  '23514': 'One or more fields failed validation.',
  '22P02': 'An input value was in the wrong format.',
  '42501': 'You do not have permission to perform this action.',
  '40001': 'A conflict occurred with another concurrent request. Please retry.',
  '40P01': 'A conflict occurred with another concurrent request. Please retry.',
}

function messageForPostgrestCode(code: string | null | undefined): string {
  if (code && POSTGRES_CODE_MESSAGES[code]) return POSTGRES_CODE_MESSAGES[code]
  return 'A database error occurred. Please retry or contact support if it persists.'
}

/**
 * Supabase PostgrestError is a plain object, not an Error instance. Throwing it
 * from a server component / action serialises poorly over the RSC stream
 * (Sentry JAVASCRIPT-NEXTJS-D, see THE-33) and its `message` leaks schema
 * detail (constraint / column / value). Wrap it in a real Error whose
 * user-facing `.message` is sanitised by SQLSTATE, and keep the original
 * message + code/details/hint attached as own properties so server logs
 * (and Sentry) still see full diagnostic info (THE-57).
 */
export function wrapPostgrestError(err: {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}): Error {
  return Object.assign(new Error(messageForPostgrestCode(err.code)), {
    code: err.code,
    details: err.details,
    hint: err.hint,
    rawMessage: err.message,
  })
}

/**
 * User-facing error string for redirect / toast surfaces. Returns a sanitised
 * one-liner — never concatenates PostgrestError `details` / `hint`, since
 * those fields routinely carry schema and row-value information.
 * Server-side logging (`console.error(error)`) still has access to the full
 * object including `rawMessage`, `details`, `hint`, and `code`.
 */
export function formatActionError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim()

  if (error instanceof Error) {
    const message = error.message?.trim()
    return message || fallback
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }

  return fallback
}
