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

function formatAxiosBody(body: unknown): string | null {
  if (body == null) return null
  if (typeof body === 'string') return truncate(body, 500)
  try {
    return truncate(JSON.stringify(body), 500)
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

  // Fingerprint by host + status so per-endpoint axios errors group
  // separately instead of collapsing all 400s into one issue.
  const host = fullUrl ? safeHost(fullUrl) : 'unknown-host'
  event.fingerprint = ['axios-error', host, String(status ?? 'unknown')]

  return event
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown-host'
  }
}
