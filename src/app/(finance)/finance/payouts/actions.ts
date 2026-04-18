'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function confirmPayoutRun(formData: FormData) {
  const agencyId = await requireFinanceAgencyId({ requireWriteAccess: true })
  const rawIds = String(formData.get('milestoneIds') ?? '')
  const ids = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const db = getSupabaseServiceRole()
  const { data: dealsForAgency } = await db.from('Deal').select('id').eq('agencyId', agencyId)
  const agencyDealIds = new Set((dealsForAgency ?? []).map((d) => d.id))
  if (agencyDealIds.size === 0) return

  let targetIds = ids
  if (targetIds.length === 0) {
    const { data: allReady } = await db
      .from('Milestone')
      .select('id')
      .in('dealId', [...agencyDealIds])
      .eq('payoutStatus', 'READY')
    targetIds = (allReady ?? []).map((row) => row.id)
  }

  if (targetIds.length === 0) return

  const { data: toUpdate } = await db
    .from('Milestone')
    .select('id, dealId')
    .in('id', targetIds)
    .in('dealId', [...agencyDealIds])
    .eq('payoutStatus', 'READY')

  const rows = (toUpdate ?? []).filter((m) => agencyDealIds.has(m.dealId))
  const idsToPay = rows.map((r) => r.id)
  if (idsToPay.length === 0) return

  const impactedDealIds = [...new Set(rows.map((r) => r.dealId))]

  const today = new Date().toISOString().slice(0, 10)
  const { error: upErr } = await db
    .from('Milestone')
    .update({
      payoutStatus: 'PAID',
      payoutDate: today,
      status: 'PAID',
    })
    .in('id', idsToPay)
  if (upErr) throw upErr

  if (impactedDealIds.length > 0) {
    const { data: dealMilestones } = await db
      .from('Milestone')
      .select('dealId, payoutStatus')
      .in('dealId', impactedDealIds)

    const completionByDeal = new Map<string, boolean>()
    for (const dealId of impactedDealIds) {
      const milestones = (dealMilestones ?? []).filter((row) => row.dealId === dealId)
      const allPaid = milestones.length > 0 && milestones.every((row) => row.payoutStatus === 'PAID')
      completionByDeal.set(dealId, allPaid)
    }

    const completedDealIds = impactedDealIds.filter((id) => completionByDeal.get(id))
    const inBillingDealIds = impactedDealIds.filter((id) => !completionByDeal.get(id))

    if (completedDealIds.length > 0) {
      const { error: e1 } = await db
        .from('Deal')
        .update({ stage: 'COMPLETED', probability: 100 })
        .in('id', completedDealIds)
        .eq('agencyId', agencyId)
      if (e1) throw e1
    }
    if (inBillingDealIds.length > 0) {
      const { error: e2 } = await db
        .from('Deal')
        .update({ stage: 'IN_BILLING', probability: 100 })
        .in('id', inBillingDealIds)
        .eq('agencyId', agencyId)
      if (e2) throw e2
    }
  }

  revalidatePath('/finance/payouts')
  revalidatePath('/finance/dashboard')
  revalidatePath('/finance/deals')
  revalidatePath('/agency/pipeline')
}
