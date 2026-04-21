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

function extractValidationMessages(elements: unknown): string[] {
  if (!Array.isArray(elements)) return []
  return elements
    .flatMap((el) => {
      const errs = (el as { ValidationErrors?: Array<{ Message?: unknown }> } | null)?.ValidationErrors
      return Array.isArray(errs) ? errs : []
    })
    .map((v) => (typeof v?.Message === 'string' ? v.Message : null))
    .filter((m): m is string => !!m)
}

function redactAxiosBody(body: unknown): Record<string, unknown> | null {
  if (body == null || typeof body !== 'object') return null
  const src = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    if (SAFE_BODY_KEYS.has(key) && (typeof src[key] === 'string' || typeof src[key] === 'number')) {
      out[key] = src[key]
    }
  }
  const validationMessages = extractValidationMessages(src.Elements)
  if (validationMessages.length > 0) {
    out.ValidationMessages = validationMessages
  }
  return Object.keys(out).length > 0 ? out : null
}

function formatAxiosBody(body: unknown): string | null {
  if (body == null) return null
  if (typeof body === 'string') {
    // Raw string bodies are typically OAuth errors ("invalid_grant", etc.) —
    // safe to pass through with a length cap.
    return truncate(body, 500)
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
