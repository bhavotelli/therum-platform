'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceAgencyId, requireFinanceUserContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function addPayoutAdjustment(formData: FormData) {
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const talentId = String(formData.get('talentId') ?? '').trim()
  const currency = String(formData.get('currency') ?? 'GBP').trim()
  const type = String(formData.get('type') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!talentId || !description || !['DEDUCTION', 'REIMBURSEMENT'].includes(type)) {
    throw new Error('Invalid adjustment data')
  }
  const amount = parseFloat(amountRaw)
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number')
  }

  const db = getSupabaseServiceRole()
  const { error } = await db.from('PayoutAdjustment').insert({
    agencyId,
    talentId,
    currency,
    type,
    amount,
    description,
    createdByUserId: userId,
  })
  if (error) throw error

  revalidatePath('/finance/payouts')
}

export async function removePayoutAdjustment(formData: FormData) {
  const { agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const adjustmentId = String(formData.get('adjustmentId') ?? '').trim()
  if (!adjustmentId) throw new Error('Missing adjustment id')

  const db = getSupabaseServiceRole()
  // Only delete if unapplied and belongs to this agency
  const { error } = await db
    .from('PayoutAdjustment')
    .delete()
    .eq('id', adjustmentId)
    .eq('agencyId', agencyId)
    .is('appliedAt', null)
  if (error) throw error

  revalidatePath('/finance/payouts')
}

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

  // Apply any pending adjustments for the talents that were just paid out
  const { data: paidMilestones } = await db
    .from('Milestone')
    .select('dealId')
    .in('id', idsToPay)
  const paidDealIds = [...new Set((paidMilestones ?? []).map((m) => m.dealId as string))]
  if (paidDealIds.length > 0) {
    const { data: paidDeals } = await db
      .from('Deal')
      .select('talentId')
      .in('id', paidDealIds)
    const paidTalentIds = [...new Set((paidDeals ?? []).map((d) => d.talentId as string))]
    if (paidTalentIds.length > 0) {
      const now = new Date().toISOString()
      await db
        .from('PayoutAdjustment')
        .update({ appliedAt: now })
        .eq('agencyId', agencyId)
        .in('talentId', paidTalentIds)
        .is('appliedAt', null)
    }
  }

  revalidatePath('/finance/payouts')
  revalidatePath('/finance/dashboard')
  revalidatePath('/finance/deals')
  revalidatePath('/agency/pipeline')
}
