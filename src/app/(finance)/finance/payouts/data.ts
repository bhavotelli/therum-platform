import { getSupabaseServiceRole } from '@/lib/supabase/service'

export type PayoutQueueItem = {
  milestoneId: string
  milestoneDescription: string
  payoutStatus: string
  dealId: string
  dealTitle: string
  currency: string
  talentName: string
  talentEmail: string
  grossAmount: number
  commissionAmount: number
  netPayoutAmount: number
}

export type PayoutTalentSummary = {
  talentName: string
  talentEmail: string
  currency: string
  milestoneCount: number
  totalGross: number
  totalCommission: number
  totalNet: number
}

export async function getPayoutQueue(agencyId: string): Promise<PayoutQueueItem[]> {
  const db = getSupabaseServiceRole()
  const { data: deals } = await db.from('Deal').select('id').eq('agencyId', agencyId)
  const dealIds = (deals ?? []).map((d) => d.id)
  if (dealIds.length === 0) return []

  const { data: milestones, error } = await db
    .from('Milestone')
    .select(
      `
      id,
      description,
      payoutStatus,
      invoiceDate,
      grossAmount,
      dealId,
      Deal (
        id,
        title,
        currency,
        Talent ( name, email )
      ),
      InvoiceTriplet ( grossAmount, commissionAmount, netPayoutAmount )
    `,
    )
    .in('dealId', dealIds)
    .eq('payoutStatus', 'READY')
    .order('invoiceDate', { ascending: true })

  if (error) throw error

  return (milestones ?? []).map((milestone) => {
    const row = milestone as typeof milestone & {
      Deal?: { id: string; title: string; currency: string | null; Talent?: { name: string; email: string } }
      InvoiceTriplet?: { grossAmount: string; commissionAmount: string; netPayoutAmount: string } | null
    }
    const deal = row.Deal
    const talent = deal?.Talent
    const triplet = row.InvoiceTriplet
    const grossAmount = Number(triplet?.grossAmount ?? row.grossAmount)
    const commissionAmount = Number(triplet?.commissionAmount ?? 0)
    const netPayoutAmount = Number(triplet?.netPayoutAmount ?? grossAmount - commissionAmount)

    return {
      milestoneId: row.id as string,
      milestoneDescription: String(row.description ?? ''),
      payoutStatus: String(row.payoutStatus ?? ''),
      dealId: deal?.id ?? '',
      dealTitle: deal?.title ?? '',
      currency: deal?.currency || 'GBP',
      talentName: talent?.name ?? '',
      talentEmail: talent?.email ?? '',
      grossAmount,
      commissionAmount,
      netPayoutAmount,
    }
  })
}

export function buildTalentSummary(items: PayoutQueueItem[]): PayoutTalentSummary[] {
  const map = new Map<string, PayoutTalentSummary>()

  for (const item of items) {
    const key = `${item.talentEmail}-${item.currency}`
    const current = map.get(key)
    if (!current) {
      map.set(key, {
        talentName: item.talentName,
        talentEmail: item.talentEmail,
        currency: item.currency,
        milestoneCount: 1,
        totalGross: item.grossAmount,
        totalCommission: item.commissionAmount,
        totalNet: item.netPayoutAmount,
      })
      continue
    }

    current.milestoneCount += 1
    current.totalGross += item.grossAmount
    current.totalCommission += item.commissionAmount
    current.totalNet += item.netPayoutAmount
  }

  return [...map.values()].sort((a, b) => a.talentName.localeCompare(b.talentName))
}
