import { getSupabaseServiceRole } from '@/lib/supabase/service'

export type PayoutAdjustment = {
  id: string
  talentId: string
  currency: string
  type: 'DEDUCTION' | 'REIMBURSEMENT'
  amount: number
  description: string
}

export type PayoutQueueItem = {
  milestoneId: string
  milestoneDescription: string
  payoutStatus: string
  dealId: string
  dealNumber: string | null
  dealTitle: string
  currency: string
  talentId: string
  talentName: string
  talentEmail: string
  grossAmount: number
  commissionAmount: number
  netPayoutAmount: number
}

export type PayoutTalentSummary = {
  talentName: string
  talentEmail: string
  talentId: string
  currency: string
  milestoneCount: number
  totalGross: number
  totalCommission: number
  totalNet: number
  adjustments: PayoutAdjustment[]
  adjustmentTotal: number
  adjustedNet: number
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
        dealNumber,
        title,
        currency,
        Talent ( id, name, email )
      ),
      InvoiceTriplet ( grossAmount, commissionAmount, netPayoutAmount )
    `,
    )
    .in('dealId', dealIds)
    .eq('payoutStatus', 'READY')
    .order('invoiceDate', { ascending: true })

  if (error) throw new Error(error.message)

  return (milestones ?? []).map((milestone) => {
    const row = milestone as typeof milestone & {
      Deal?: { id: string; dealNumber: string | null; title: string; currency: string | null; Talent?: { id: string; name: string; email: string } }
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
      dealNumber: deal?.dealNumber ?? null,
      dealTitle: deal?.title ?? '',
      currency: deal?.currency || 'GBP',
      talentId: talent?.id ?? '',
      talentName: talent?.name ?? '',
      talentEmail: talent?.email ?? '',
      grossAmount,
      commissionAmount,
      netPayoutAmount,
    }
  })
}

export async function getPendingAdjustments(agencyId: string): Promise<PayoutAdjustment[]> {
  const db = getSupabaseServiceRole()
  const { data, error } = await db
    .from('PayoutAdjustment')
    .select('id, talentId, currency, type, amount, description')
    .eq('agencyId', agencyId)
    .is('appliedAt', null)
    .order('createdAt', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    talentId: row.talentId as string,
    currency: row.currency as string,
    type: row.type as 'DEDUCTION' | 'REIMBURSEMENT',
    amount: Number(row.amount),
    description: row.description as string,
  }))
}

export function buildTalentSummary(items: PayoutQueueItem[], adjustments: PayoutAdjustment[] = []): PayoutTalentSummary[] {
  const map = new Map<string, PayoutTalentSummary>()

  for (const item of items) {
    const key = `${item.talentEmail}-${item.currency}`
    const current = map.get(key)
    if (!current) {
      map.set(key, {
        talentName: item.talentName,
        talentEmail: item.talentEmail,
        talentId: item.talentId,
        currency: item.currency,
        milestoneCount: 1,
        totalGross: item.grossAmount,
        totalCommission: item.commissionAmount,
        totalNet: item.netPayoutAmount,
        adjustments: [],
        adjustmentTotal: 0,
        adjustedNet: item.netPayoutAmount,
      })
      continue
    }

    current.milestoneCount += 1
    current.totalGross += item.grossAmount
    current.totalCommission += item.commissionAmount
    current.totalNet += item.netPayoutAmount
    current.adjustedNet += item.netPayoutAmount
  }

  // Attach adjustments to matching talent+currency entries
  for (const adj of adjustments) {
    for (const [, summary] of map) {
      if (summary.talentId === adj.talentId && summary.currency === adj.currency) {
        summary.adjustments.push(adj)
        const delta = adj.type === 'REIMBURSEMENT' ? adj.amount : -adj.amount
        summary.adjustmentTotal += delta
        summary.adjustedNet += delta
      }
    }
  }

  return [...map.values()].sort((a, b) => a.talentName.localeCompare(b.talentName))
}
