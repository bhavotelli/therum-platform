export const DEAL_PREFIX_RE = /^[A-Z]{2,4}$/
export const DEAL_PREFIX_PATTERN = '[A-Z]{2,4}'
export const DEAL_PREFIX_MIN = 2
export const DEAL_PREFIX_MAX = 4
export const DEAL_PREFIX_ERROR = 'Prefix must be 2–4 uppercase letters (A–Z) only.'

export function sanitiseDealPrefix(raw: string): string {
  return raw
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, DEAL_PREFIX_MAX)
}

export function isValidDealPrefix(value: string): boolean {
  return DEAL_PREFIX_RE.test(value)
}
