import type { ErrorEvent, EventHint } from '@sentry/nextjs'

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

type AxiosResponseShape = {
  status?: number
  statusText?: string
  data?: unknown
}

type AxiosConfigShape = {
  url?: string
  baseURL?: string
  method?: string
}

type AxiosErrorShape = {
  isAxiosError?: boolean
  name?: string
  message?: string
  code?: string
  response?: AxiosResponseShape
  config?: AxiosConfigShape
}

function isAxiosError(err: unknown): err is AxiosErrorShape {
  if (err === null || typeof err !== 'object') return false
  const record = err as Record<string, unknown>
  if (record.isAxiosError === true) return true
  return record.name === 'AxiosError'
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}... (truncated)` : value
}

/**
 * Keys we keep from a Xero / OAuth error response body. Everything else is
 * dropped before the body reaches Sentry because Xero responses routinely
 * contain PII (names, emails, addresses, VAT numbers) that Sentry storage is
 * not GDPR-safe for. Error-shaped responses expose only the message fields.
 */
const SAFE_BODY_KEYS = new Set([
  'Message',
  'Detail',
  'Title',
  'Type',
  'Status',
  'Instance',
  'ErrorNumber',
  'error',
  'error_description',
])

function redactAxiosBody(body: unknown): Record<string, unknown> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    if (SAFE_BODY_KEYS.has(key) && (typeof src[key] === 'string' || typeof src[key] === 'number')) {
      out[key] = src[key]
    }
  }
  // Xero ValidationErrors.Message strings can embed customer-provided values
  // (contact names, addresses, line-item descriptions). Don't forward them —
  // the top-level Message/Detail/Title fields are enough to diagnose the
  // failure class, and Xero's validation usually duplicates the key error
  // into those. If a field is hidden inside Elements only, we accept the
  // coarser signal in exchange for GDPR safety.
  return Object.keys(out).length > 0 ? out : null
}

// OAuth error codes that are safe to send verbatim — they are enumerated
// constants defined by RFC 6749 and extensions, with no embedded PII.
const SAFE_OAUTH_STRING_BODIES = new Set([
  'invalid_grant',
  'invalid_client',
  'invalid_request',
  'invalid_scope',
  'unauthorized_client',
  'unsupported_grant_type',
  'access_denied',
])

function formatAxiosBody(body: unknown): string | null {
  if (body == null) return null
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (SAFE_OAUTH_STRING_BODIES.has(trimmed)) return trimmed
    // Xero (and upstream Cloudflare) can return HTML error pages under load
    // or during outages. The HTML may contain support / trace IDs that
    // correlate to the requesting agency, so redact rather than forward.
    if (/^<!doctype|^<html/i.test(trimmed)) return '[HTML error page redacted]'
    // Unknown shape — don't pass arbitrary strings through because we can't
    // guarantee they're PII-free.
    return '[redacted]'
  }
  const redacted = redactAxiosBody(body)
  if (!redacted) return '[redacted]'
  try {
    return truncate(JSON.stringify(redacted), 500)
  } catch {
    return null
  }
}

function joinUrl(baseURL: string | undefined, url: string | undefined): string | undefined {
  if (!url) return baseURL
  if (!baseURL) return url
  if (/^https?:\/\//.test(url)) return url
  return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
}

/**
 * Rewrite a Sentry event for an AxiosError so the message carries the HTTP
 * method + URL + status + response body instead of the context-free default
 * ("Request failed with status code 400"). Without this, axios failures group
 * by status code only and the actual failing endpoint is lost in the stack.
 *
 * No-op for non-Axios errors — returns the event unchanged.
 */
export function enrichAxiosErrorEvent(event: ErrorEvent, hint: EventHint | undefined): ErrorEvent {
  const err = hint?.originalException
  if (!isAxiosError(err)) return event

  const method = err.config?.method?.toUpperCase()
  const fullUrl = joinUrl(err.config?.baseURL, err.config?.url)
  const status = err.response?.status
  const statusText = err.response?.statusText
  const body = formatAxiosBody(err.response?.data)

  const parts: string[] = []
  if (typeof status === 'number') parts.push(`${status}${statusText ? ` ${statusText}` : ''}`)
  if (method && fullUrl) parts.push(`${method} ${fullUrl}`)
  else if (fullUrl) parts.push(fullUrl)
  if (body) parts.push(`body=${body}`)
  if (err.code) parts.push(`code=${err.code}`)

  const enriched = parts.length > 0 ? `AxiosError: ${parts.join(' — ')}` : err.message

  event.message = enriched
  if (event.exception?.values?.[0]) {
    event.exception.values[0].value = enriched
  }

  event.tags = {
    ...(event.tags ?? {}),
    'axios.status': typeof status === 'number' ? String(status) : 'unknown',
    'axios.method': method ?? 'unknown',
    'axios.host': fullUrl ? safeHost(fullUrl) : 'unknown',
  }

  event.extra = {
    ...(event.extra ?? {}),
    axiosUrl: fullUrl,
    axiosMethod: method,
    axiosStatus: status,
    axiosStatusText: statusText,
    axiosResponseBody: body,
    axiosCode: err.code,
  }

  // Fingerprint by host + method + status so per-endpoint axios errors
  // group separately — GET /Invoices 400 and POST /Invoices 400 are
  // distinct failure modes that should not share an issue.
  const host = fullUrl ? safeHost(fullUrl) : 'unknown-host'
  event.fingerprint = ['axios-error', host, method ?? 'unknown', String(status ?? 'unknown')]

  return event
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown-host'
  }
}
