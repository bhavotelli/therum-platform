/**
 * Parser for Talent.registeredAddress (free-text multi-line column) into the
 * structured shape Xero's `Contact.Addresses` expects. The column is captured
 * by the agency in NewTalentForm as a single textarea, so we get arbitrary
 * formatting; rather than force a schema change we do best-effort parsing here.
 *
 * Returns `[]` when the input is empty/null so callers can spread-conditional
 * the field out of the Xero payload entirely (sending an empty `Addresses`
 * array would clear any existing address on the Xero contact).
 */

type XeroAddress = {
  addressType: 'STREET'
  addressLine1?: string
  addressLine2?: string
  city?: string
  postalCode?: string
  country?: string
}

// Small allowlist of country names that can appear on the last line of an
// address. Kept short on purpose — we'd rather under-detect than over-detect
// (false positive moves a real city/region into the country slot in Xero).
// Extend as design partners surface new markets.
const COUNTRY_ALLOWLIST = new Set([
  'united kingdom',
  'uk',
  'great britain',
  'gb',
  'united states',
  'united states of america',
  'usa',
  'us',
  'ireland',
  'france',
  'germany',
  'spain',
  'netherlands',
  'australia',
  'canada',
])

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

export function parseRegisteredAddressForXero(raw: string | null | undefined): XeroAddress[] {
  if (!raw) return []
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const out: XeroAddress = { addressType: 'STREET' }

  // 1. Country: only if the last line matches the allowlist, pop it.
  const last = lines[lines.length - 1]
  if (COUNTRY_ALLOWLIST.has(last.toLowerCase())) {
    out.country = last
    lines.pop()
  }

  // 2. Postcode: scan remaining lines. If a line is *just* a postcode, pull it
  //    out; if a line contains a postcode mixed with city text, split.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(UK_POSTCODE_RE)
    if (!m) continue
    const postcode = m[0].toUpperCase()
    const without = line.replace(m[0], '').replace(/[\s,]+$/, '').replace(/^[\s,]+/, '').trim()
    out.postalCode = postcode
    if (without.length > 0 && !out.city) {
      out.city = without
    }
    lines.splice(i, 1)
    break
  }

  // 3. Whatever is left fills addressLine1, addressLine2, city in order.
  if (lines.length > 0) out.addressLine1 = lines[0]
  if (lines.length > 1) {
    if (!out.city) {
      // 2-line address with no postcode: line[1] is most likely the city/town.
      out.city = lines[1]
    } else {
      out.addressLine2 = lines[1]
    }
  }
  if (lines.length > 2 && !out.city) {
    out.city = lines[2]
  } else if (lines.length > 2 && !out.addressLine2) {
    out.addressLine2 = lines[2]
  }

  // If we ended up with literally nothing usable, return empty so the caller
  // omits the addresses field rather than sending an empty STREET row.
  if (!out.addressLine1 && !out.city && !out.postalCode && !out.country) {
    return []
  }
  return [out]
}
