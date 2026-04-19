'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function disconnectXero() {
  const agencyId = await requireFinanceAgencyId()

  const db = getSupabaseServiceRole()
  const { error } = await db.from('Agency').update({ xeroTokens: null, xeroTenantId: null }).eq('id', agencyId)
  if (error) throw error

  revalidatePath('/finance/settings')
}
