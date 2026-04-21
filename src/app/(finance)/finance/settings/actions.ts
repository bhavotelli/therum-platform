'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function disconnectXero() {
  const agencyId = await requireFinanceAgencyId()

  const db = getSupabaseServiceRole()
  const { error } = await db.from('Agency').update({ xeroTokens: null, xeroTenantId: null }).eq('id', agencyId)
  if (error) throw new Error(error.message)

  revalidatePath('/finance/settings')
}

export type DealPrefixActionResult = { error?: string }

export async function updateDealNumberPrefix(formData: FormData): Promise<DealPrefixActionResult> {
  const agencyId = await requireFinanceAgencyId()
  const raw = String(formData.get('dealNumberPrefix') ?? '').trim().toUpperCase()

  if (!raw) return { error: 'Prefix is required.' }
  if (!/^[A-Z]{2,4}$/.test(raw)) return { error: 'Prefix must be 2–4 uppercase letters (A–Z) only.' }

  const db = getSupabaseServiceRole()

  // Once a prefix is set it is immutable — deals already created carry the prefix
  // in their dealNumber and milestoneRef, so changing it would orphan those references.
  const { data: agency } = await db.from('Agency').select('dealNumberPrefix').eq('id', agencyId).maybeSingle()
  if (agency?.dealNumberPrefix) {
    return { error: `Prefix is already set to "${agency.dealNumberPrefix}" and cannot be changed once deals have been numbered.` }
  }

  const { error } = await db.from('Agency').update({ dealNumberPrefix: raw }).eq('id', agencyId)

  if (error) {
    // Unique index violation — another agency already uses this prefix.
    if (error.code === '23505') return { error: `"${raw}" is already in use by another agency. Choose a different prefix.` }
    return { error: error.message }
  }

  revalidatePath('/finance/settings')
  return {}
}
