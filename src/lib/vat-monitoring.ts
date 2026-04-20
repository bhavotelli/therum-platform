import { getSupabaseServiceRole } from '@/lib/supabase/service'

export const VAT_THRESHOLD = 90_000
export const VAT_RED_START = 85_000
export const VAT_AMBER_START = 75_000

export type VatBand = 'green' | 'amber' | 'red'

export type TalentVatStatus = {
  talentId: string
  talentName: string
  talentEmail: string
  rolling12mTotal: number
  band: VatBand
  pctOfThreshold: number
  remainingToThreshold: number
}

export function computeVatBand(total: number): VatBand {
  if (total >= VAT_RED_START) return 'red'
  if (total >= VAT_AMBER_START) return 'amber'
  return 'green'
}

export function buildVatStatus(
  talent: { id: string; name: string; email: string },
  total: number,
): TalentVatStatus {
  return {
    talentId: talent.id,
    talentName: talent.name,
    talentEmail: talent.email,
    rolling12mTotal: total,
    band: computeVatBand(total),
    pctOfThreshold: Math.min(100, Math.round((total / VAT_THRESHOLD) * 100)),
    remainingToThreshold: Math.max(0, VAT_THRESHOLD - total),
  }
}

export async function getVatMonitoringForAgency(agencyId: string): Promise<TalentVatStatus[]> {
  const db = getSupabaseServiceRole()

  // Only non-VAT-registered talent with no VAT number set
  const { data: talentRows } = await db
    .from('Talent')
    .select('id, name, email')
    .eq('agencyId', agencyId)
    .eq('vatRegistered', false)
    .is('vatNumber', null)

  const talents = (talentRows ?? []) as { id: string; name: string; email: string }[]
  if (talents.length === 0) return []

  const talentIds = talents.map((t) => t.id)

  const { data: dealRows } = await db
    .from('Deal')
    .select('id, talentId')
    .eq('agencyId', agencyId)
    .in('talentId', talentIds)

  if (!dealRows?.length) return talents.map((t) => buildVatStatus(t, 0))

  const dealIds = dealRows.map((d) => d.id as string)
  const talentByDealId = new Map(dealRows.map((d) => [d.id as string, d.talentId as string]))

  const { data: milestoneRows } = await db
    .from('Milestone')
    .select('id, dealId')
    .in('dealId', dealIds)

  if (!milestoneRows?.length) return talents.map((t) => buildVatStatus(t, 0))

  const milestoneIds = milestoneRows.map((m) => m.id as string)
  const talentByMilestoneId = new Map(
    milestoneRows.map((m) => [m.id as string, talentByDealId.get(m.dealId as string)!]),
  )

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  const { data: tripletRows } = await db
    .from('InvoiceTriplet')
    .select('milestoneId, netPayoutAmount')
    .in('milestoneId', milestoneIds)
    .gte('invoiceDate', cutoff.toISOString().slice(0, 10))
    .neq('approvalStatus', 'REJECTED')

  const totalByTalentId = new Map<string, number>()
  for (const triplet of (tripletRows ?? [])) {
    const talentId = talentByMilestoneId.get(triplet.milestoneId as string)
    if (!talentId) continue
    totalByTalentId.set(talentId, (totalByTalentId.get(talentId) ?? 0) + Number(triplet.netPayoutAmount))
  }

  return talents
    .map((t) => buildVatStatus(t, totalByTalentId.get(t.id) ?? 0))
    .sort((a, b) => b.rolling12mTotal - a.rolling12mTotal)
}
