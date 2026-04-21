'use server'

import { revalidatePath } from 'next/cache'

import { wrapPostgrestError } from '@/lib/errors'
import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { DEAL_PREFIX_ERROR, isValidDealPrefix } from '@/lib/validation/dealPrefix'

function shortRef(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`
}

export async function disconnectXero() {
  const agencyId = await requireFinanceAgencyId()

  const db = getSupabaseServiceRole()
  const { error } = await db.from('Agency').update({ xeroTokens: null, xeroTenantId: null }).eq('id', agencyId)
  if (error) throw wrapPostgrestError(error)

  revalidatePath('/finance/settings')
}

export type DealPrefixActionResult = { error?: string }

export async function updateDealNumberPrefix(formData: FormData): Promise<DealPrefixActionResult> {
  // Auth outside try-catch so failures redirect/throw properly (not swallowed as user-facing errors).
  // requireWriteAccess prevents read-only SUPER_ADMIN impersonation sessions from mutating the prefix.
  const agencyId = await requireFinanceAgencyId({ requireWriteAccess: true })

  // Internal assertion — requireFinanceAgencyId is typed to return a string, but if that
  // contract ever breaks we surface a graceful error rather than a service-role query without
  // a tenant filter (or a crash page).
  if (!agencyId) {
    console.error('[updateDealNumberPrefix] CRITICAL: agencyId null after requireFinanceAgencyId')
    return { error: 'Session error — please refresh and try again.' }
  }

  try {
    const raw = String(formData.get('dealNumberPrefix') ?? '').trim().toUpperCase()

    if (!raw) return { error: 'Prefix is required.' }
    if (!isValidDealPrefix(raw)) return { error: DEAL_PREFIX_ERROR }

    const db = getSupabaseServiceRole()

    // Service role bypasses RLS — agencyId filter is critical for tenant isolation.
    // Once a prefix is set it is immutable — deals already created carry the prefix
    // in their dealNumber and milestoneRef, so changing it would orphan those references.
    const { data: agency, error: fetchError } = await db
      .from('Agency')
      .select('dealNumberPrefix')
      .eq('id', agencyId)
      .maybeSingle()
    if (fetchError) throw wrapPostgrestError(fetchError)
    if (agency?.dealNumberPrefix) {
      return { error: `Prefix is already set to "${agency.dealNumberPrefix}" and cannot be changed once deals have been numbered.` }
    }

    const { error } = await db.from('Agency').update({ dealNumberPrefix: raw }).eq('id', agencyId)

    if (error) {
      // Unique index violation — another agency already uses this prefix.
      if (error.code === '23505') return { error: `"${raw}" is already in use by another agency. Choose a different prefix.` }
      // Don't expose raw DB error messages to the client; log the full ISO timestamp
      // and surface a short ref to the user so support can correlate both sides.
      const ref = shortRef()
      console.error('[updateDealNumberPrefix] Database error:', { code: error.code, message: error.message, ref, ts: new Date().toISOString() })
      return { error: `Failed to save prefix — please try again or contact support (ref: ${ref}).` }
    }

    revalidatePath('/finance/settings')
    return {}
  } catch (err) {
    const ref = shortRef()
    console.error('[updateDealNumberPrefix] Unexpected error:', err, { ref, ts: new Date().toISOString() })
    return { error: `Failed to update prefix — please try again or contact support (ref: ${ref}).` }
  }
}
