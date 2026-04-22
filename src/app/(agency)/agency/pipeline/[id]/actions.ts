'use server'

import { revalidatePath } from 'next/cache'

import { getAgencySessionContext } from '@/lib/agencyAuth'
import { wrapPostgrestError } from '@/lib/errors'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { ExpenseCategory, ExpenseIncurredBy } from '@/types/database'

export async function markMilestoneComplete(milestoneId: string) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()

  const { data: milestone, error: mErr } = await db.from('Milestone').select('*').eq('id', milestoneId).maybeSingle()
  if (mErr) throw new Error(mErr.message)
  if (!milestone) throw new Error('Milestone not found')
  if (milestone.status !== 'PENDING') throw new Error('Milestone is not PENDING')

  const { data: deal, error: dErr } = await db.from('Deal').select('*').eq('id', milestone.dealId).maybeSingle()
  if (dErr) throw new Error(dErr.message)
  if (!deal || deal.agencyId !== context.agencyId) throw new Error('Milestone not found')

  const [{ data: agency }, { data: client }, { data: talent }] = await Promise.all([
    db.from('Agency').select('*').eq('id', deal.agencyId).maybeSingle(),
    db.from('Client').select('*').eq('id', deal.clientId).maybeSingle(),
    db.from('Talent').select('*').eq('id', deal.talentId).maybeSingle(),
  ])
  if (!agency || !client || !talent) throw new Error('Related data not found')

  const { data: billableExpenses } = await db
    .from('DealExpense')
    .select('*')
    .eq('dealId', milestone.dealId)
    .eq('agencyId', context.agencyId)
    .eq('rechargeable', true)
    .eq('status', 'APPROVED')
    .is('invoicedOnInvId', null)

  const expenses = billableExpenses ?? []
  const totalBillableExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0)

  const baseGross = Number(milestone.grossAmount)
  const commissionRate = Number(deal.commissionRate)

  const agencyVat = agency.vatRegistered
  const talentVat = talent.vatRegistered
  const invoicingModel = agency.invoicingModel

  const baseCommission = baseGross * (commissionRate / 100)
  const comVatAmount = agencyVat ? baseCommission * 0.2 : 0
  const comGross = baseCommission + comVatAmount

  let grossAmountToSave: number
  let netPayoutAmountToSave: number

  if (invoicingModel === 'SELF_BILLING') {
    const invTotalBeforeVat = baseGross + totalBillableExpenses
    const invVatAmount = agencyVat ? invTotalBeforeVat * 0.2 : 0
    const invGross = invTotalBeforeVat + invVatAmount
    const sbiVatAmount = talentVat ? baseGross * 0.2 : 0
    const sbiGross = baseGross + sbiVatAmount
    grossAmountToSave = invGross
    netPayoutAmountToSave = sbiGross - comGross
  } else {
    const obiTotalBeforeVat = baseGross + totalBillableExpenses
    const obiVatAmount = talentVat ? obiTotalBeforeVat * 0.2 : 0
    const obiGross = obiTotalBeforeVat + obiVatAmount
    // Net payout is on talent's base gross only — expenses are charged to client but not remitted to talent
    const talentPayoutBase = baseGross + (talentVat ? baseGross * 0.2 : 0)
    grossAmountToSave = obiGross
    netPayoutAmountToSave = talentPayoutBase - comGross
  }

  const paymentTermsDays = deal.paymentTermsDays ?? client.paymentTermsDays

  // Reference numbers (invNumber, sbiNumber, obiNumber, cnNumber, comNumber) are assigned
  // by Xero when the triplet is approved and pushed. They are null until that point.
  const tripletData: Record<string, unknown> = {
    milestoneId: milestone.id,
    invoicingModel,
    grossAmount: String(grossAmountToSave),
    commissionRate: String(commissionRate),
    commissionAmount: String(comGross),
    netPayoutAmount: String(netPayoutAmountToSave),
    invoiceDate: typeof milestone.invoiceDate === 'string' ? milestone.invoiceDate.slice(0, 10) : milestone.invoiceDate,
    invDueDateDays: paymentTermsDays,
    approvalStatus: 'PENDING',
    issuedAt: new Date().toISOString(),
  }

  const { error: upM } = await db
    .from('Milestone')
    .update({ status: 'COMPLETE', completedAt: new Date().toISOString() })
    .eq('id', milestoneId)
  if (upM) throw upM

  const { data: triplet, error: tErr } = await db.from('InvoiceTriplet').insert(tripletData).select('id').single()
  if (tErr) throw wrapPostgrestError(tErr)

  const { error: upDeal } = await db
    .from('Deal')
    .update({ stage: 'IN_BILLING', probability: 100 })
    .eq('id', milestone.dealId)
  if (upDeal) throw wrapPostgrestError(upDeal)

  if (expenses.length > 0 && triplet?.id) {
    const { error: upE } = await db
      .from('DealExpense')
      .update({ status: 'INVOICED', invoicedOnInvId: triplet.id })
      .in(
        'id',
        expenses.map((e) => e.id),
      )
    if (upE) throw wrapPostgrestError(upE)
  }

  revalidatePath(`/agency/pipeline/${milestone.dealId}`)
  return { success: true }
}

export async function addExpense(formData: {
  dealId: string
  agencyId: string
  description: string
  category: string
  amount: number
  currency: string
  rechargeable: boolean
  contractSignOff: boolean
  incurredBy: string
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  if (formData.agencyId !== context.agencyId) {
    throw new Error('Unauthorized agency context.')
  }

  if (!Number.isFinite(formData.amount) || formData.amount <= 0) {
    throw new Error('Amount must be greater than 0.')
  }

  const db = getSupabaseServiceRole()
  const { data: deal } = await db
    .from('Deal')
    .select('id')
    .eq('id', formData.dealId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (!deal) {
    throw new Error('Deal not found in your agency.')
  }

  const { data: expense, error } = await db
    .from('DealExpense')
    .insert({
      dealId: formData.dealId,
      agencyId: formData.agencyId,
      description: formData.description,
      category: formData.category as ExpenseCategory,
      amount: String(formData.amount),
      currency: formData.currency,
      rechargeable: formData.rechargeable,
      contractSignOff: formData.contractSignOff,
      incurredBy: formData.incurredBy as ExpenseIncurredBy,
      status: 'APPROVED',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath(`/agency/pipeline/${formData.dealId}`)
  return { success: true, id: expense?.id }
}

export async function updateDealWorkspace(input: {
  dealId: string
  notes: string
  contractRef: string
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()
  const { data: deal } = await db
    .from('Deal')
    .select('id')
    .eq('id', input.dealId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (!deal) {
    throw new Error('Deal not found in your agency.')
  }

  const { error } = await db
    .from('Deal')
    .update({
      notes: input.notes.trim() || null,
      contractRef: input.contractRef.trim() || null,
    })
    .eq('id', input.dealId)
  if (error) throw new Error(error.message)

  revalidatePath(`/agency/pipeline/${input.dealId}`)
  return { success: true }
}

export async function createDeliverable(input: {
  milestoneId: string
  title: string
  dueDate?: string
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()
  const { data: milestone } = await db.from('Milestone').select('id, dealId').eq('id', input.milestoneId).maybeSingle()
  if (!milestone) throw new Error('Milestone not found')
  const { data: deal } = await db.from('Deal').select('agencyId').eq('id', milestone.dealId).maybeSingle()
  if (!deal || deal.agencyId !== context.agencyId) {
    throw new Error('Milestone not found in your agency.')
  }

  const { error } = await db.from('Deliverable').insert({
    milestoneId: input.milestoneId,
    title: input.title.trim(),
    dueDate: input.dueDate ? input.dueDate.slice(0, 10) : null,
    status: 'PENDING',
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/agency/pipeline/${milestone.dealId}`)
  return { success: true }
}

export async function updateDeliverableStatus(input: {
  deliverableId: string
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED'
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()
  const { data: del } = await db.from('Deliverable').select('id, milestoneId').eq('id', input.deliverableId).maybeSingle()
  if (!del) throw new Error('Deliverable not found')
  const { data: milestone } = await db.from('Milestone').select('dealId').eq('id', del.milestoneId).maybeSingle()
  if (!milestone) throw new Error('Deliverable not found')
  const { data: deal } = await db.from('Deal').select('agencyId').eq('id', milestone.dealId).maybeSingle()
  if (!deal || deal.agencyId !== context.agencyId) {
    throw new Error('Deliverable not found in your agency.')
  }

  const { error } = await db.from('Deliverable').update({ status: input.status }).eq('id', input.deliverableId)
  if (error) throw new Error(error.message)

  revalidatePath(`/agency/pipeline/${milestone.dealId}`)
  return { success: true }
}
