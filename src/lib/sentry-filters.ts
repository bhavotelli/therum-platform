/**
 * Returns true for Next.js internal control-flow errors that are thrown by
 * redirect() and notFound(). These are not real errors and should be dropped
 * before they reach Sentry.
 */
export function isNextJsControlFlowError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    /^NEXT_(REDIRECT|NOT_FOUND)/.test((err as { digest: string }).digest)
  )
}
