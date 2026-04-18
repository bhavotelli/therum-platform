import { getSupabaseServiceRole } from '@/lib/supabase/service'

/** Milestone IDs for all deals belonging to an agency (for scoping InvoiceTriplet and similar). */
export async function getMilestoneIdsForAgency(agencyId: string): Promise<string[]> {
  const db = getSupabaseServiceRole()
  const { data: deals } = await db.from('Deal').select('id').eq('agencyId', agencyId)
  const dealIds = (deals ?? []).map((d) => d.id as string)
  if (dealIds.length === 0) return []
  const { data: ms } = await db.from('Milestone').select('id').in('dealId', dealIds)
  return (ms ?? []).map((m) => m.id as string)
}
