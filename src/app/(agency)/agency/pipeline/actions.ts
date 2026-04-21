'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getAgencySessionContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { DealStage } from '@/types/database'

const STAGE_ORDER: DealStage[] = ['PIPELINE', 'NEGOTIATING', 'CONTRACTED', 'ACTIVE', 'IN_BILLING', 'COMPLETED']
const DEFAULT_STAGE_PROBABILITY: Record<DealStage, number> = {
  PIPELINE: 10,
  NEGOTIATING: 40,
  CONTRACTED: 80,
  ACTIVE: 100,
  IN_BILLING: 100,
  COMPLETED: 100,
}

type ReadinessCheckItem = {
  id: string
  status: 'pass' | 'warn' | 'block'
  message: string
}

function assertValidStageTransition(current: DealStage, target: DealStage) {
  if (current === target) return
  const currentIndex = STAGE_ORDER.indexOf(current)
  const targetIndex = STAGE_ORDER.indexOf(target)
  if (currentIndex === -1 || targetIndex === -1) {
    throw new Error('Invalid deal stage.')
  }

  if (Math.abs(targetIndex - currentIndex) > 1) {
    throw new Error(`Invalid stage transition: ${current} -> ${target}. Move one stage at a time.`)
  }
}

export async function getDealActivationReadiness(dealId: string): Promise<ReadinessCheckItem[]> {
  const context = await getAgencySessionContext()
  const db = getSupabaseServiceRole()
  const { data: deal, error: dErr } = await db.from('Deal').select('*').eq('id', dealId).eq('agencyId', context.agencyId).maybeSingle()
  if (dErr) throw new Error(dErr.message)
  if (!deal) {
    throw new Error('Deal not found.')
  }

  const [{ data: agency }, { data: talent }, { data: contacts }, { data: milestones }] = await Promise.all([
    db.from('Agency').select('id, invoicingModel').eq('id', deal.agencyId).maybeSingle(),
    db.from('Talent').select('xeroContactId').eq('id', deal.talentId).maybeSingle(),
    db.from('ClientContact').select('role').eq('clientId', deal.clientId),
    db.from('Milestone').select('id, grossAmount, invoiceDate').eq('dealId', dealId),
  ])

  const mids = (milestones ?? []).map((m) => m.id)
  const { data: dels } = mids.length ? await db.from('Deliverable').select('milestoneId').in('milestoneId', mids) : { data: [] }
  const deliverableCountByMilestone = new Map<string, number>()
  for (const d of dels ?? []) {
    deliverableCountByMilestone.set(d.milestoneId, (deliverableCountByMilestone.get(d.milestoneId) ?? 0) + 1)
  }

  const ms = milestones ?? []
  const invalidMilestoneAmount = ms.some((m) => Number(m.grossAmount) <= 0)
  const missingInvoiceDates = ms.some((m) => !m.invoiceDate)
  const milestonesWithoutDeliverables = ms.some((m) => (deliverableCountByMilestone.get(m.id) ?? 0) === 0)
  const hasFinanceContact = (contacts ?? []).some((c) => c.role === 'FINANCE')

  const checklist: ReadinessCheckItem[] = [
    {
      id: 'invoicing_model',
      status: agency?.invoicingModel ? 'pass' : 'block',
      message: agency?.invoicingModel
        ? 'Invoicing model is configured.'
        : 'Agency invoicing model is not configured.',
    },
    {
      id: 'milestones_exist',
      status: ms.length > 0 ? 'pass' : 'block',
      message: ms.length > 0 ? 'At least one milestone exists.' : 'At least one milestone is required.',
    },
    {
      id: 'milestone_amounts',
      status: invalidMilestoneAmount ? 'block' : 'pass',
      message: invalidMilestoneAmount
        ? 'All milestones must have an amount greater than 0.'
        : 'All milestone amounts are valid.',
    },
    {
      id: 'milestone_invoice_dates',
      status: missingInvoiceDates ? 'block' : 'pass',
      message: missingInvoiceDates ? 'One or more milestones are missing invoice dates.' : 'All milestone invoice dates are set.',
    },
    {
      id: 'milestone_deliverables',
      status: milestonesWithoutDeliverables ? 'block' : 'pass',
      message: milestonesWithoutDeliverables
        ? 'One or more milestones have no deliverables.'
        : 'All milestones have at least one deliverable.',
    },
    {
      id: 'talent_xero_contact',
      status: talent?.xeroContactId ? 'pass' : 'block',
      message: talent?.xeroContactId
        ? 'Talent is linked to a Xero contact.'
        : 'Talent is not linked to a Xero contact.',
    },
    {
      id: 'client_finance_contact',
      status: hasFinanceContact ? 'pass' : 'warn',
      message: hasFinanceContact ? 'Client has a FINANCE contact.' : 'Client has no FINANCE contact.',
    },
    {
      id: 'contract_reference',
      status: deal.contractRef ? 'pass' : 'warn',
      message: deal.contractRef ? 'Contract reference is set.' : 'No contract reference has been added.',
    },
  ]

  return checklist
}

export async function createDeal(formData: {
  agencyId: string
  clientId: string
  talentId: string
  title: string
  commissionRate: number
  currency: string
  stage?: DealStage
  milestones: {
    description: string
    grossAmount: number
    invoiceDate: string
  }[]
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const { agencyId, clientId, talentId, title, commissionRate, currency, stage, milestones } = formData
  if (agencyId !== context.agencyId) {
    throw new Error('Unauthorized agency context.')
  }

  const selectedStage = stage && STAGE_ORDER.includes(stage) ? stage : 'PIPELINE'
  const db = getSupabaseServiceRole()

  // dealNumber is assigned atomically by the assign_deal_number DB trigger on INSERT.
  const { data: newDeal, error: dealErr } = await db
    .from('Deal')
    .insert({
      agencyId,
      clientId,
      talentId,
      title,
      commissionRate: String(commissionRate),
      currency,
      stage: selectedStage,
      probability: DEFAULT_STAGE_PROBABILITY[selectedStage],
    })
    .select('id')
    .single()
  if (dealErr) throw dealErr
  if (!newDeal) throw new Error('Failed to create deal')

  if (milestones.length > 0) {
    // Sort by invoiceDate ASC before inserting so the assign_milestone_ref trigger
    // assigns M01 to the earliest milestone, M02 to the next, etc.
    const sorted = [...milestones].sort(
      (a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime(),
    )
    const { error: mErr } = await db.from('Milestone').insert(
      sorted.map((m) => ({
        dealId: newDeal.id,
        description: m.description,
        grossAmount: String(m.grossAmount),
        invoiceDate: m.invoiceDate.slice(0, 10),
        status: 'PENDING',
      })),
    )
    if (mErr) throw new Error(mErr.message)
  }

  revalidatePath('/agency/pipeline')
  redirect(`/agency/pipeline/${newDeal.id}`)
}

export async function updateDeal(formData: {
  dealId: string
  title: string
  clientId: string
  talentId: string
  commissionRate: number
  currency: string
  stage: DealStage
  acknowledgedWarningIds?: string[]
  milestones: {
    id?: string
    description: string
    grossAmount: number
    invoiceDate: string
  }[]
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const { dealId, title, clientId, talentId, commissionRate, currency, stage, milestones, acknowledgedWarningIds } = formData

  const db = getSupabaseServiceRole()
  const { data: existingDeal, error: exErr } = await db
    .from('Deal')
    .select('agencyId, stage')
    .eq('id', dealId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (exErr) throw new Error(exErr.message)
  if (!existingDeal) {
    throw new Error('Deal not found in your agency.')
  }
  if (stage === 'IN_BILLING' || stage === 'COMPLETED') {
    throw new Error('IN BILLING and COMPLETED are system-controlled stages.')
  }
  assertValidStageTransition(existingDeal.stage as DealStage, stage)
  if (existingDeal.stage !== 'ACTIVE' && stage === 'ACTIVE') {
    const checklist = await getDealActivationReadiness(dealId)
    const hardBlocks = checklist.filter((item) => item.status === 'block')
    if (hardBlocks.length > 0) {
      throw new Error(`Readiness gate failed: ${hardBlocks.map((item) => item.message).join(' ')}`)
    }
    const warningIds = checklist.filter((item) => item.status === 'warn').map((item) => item.id)
    const acknowledged = new Set(acknowledgedWarningIds ?? [])
    const unacknowledgedWarnings = warningIds.filter((id) => !acknowledged.has(id))
    if (unacknowledgedWarnings.length > 0) {
      throw new Error('Readiness warnings must be acknowledged before activation.')
    }
  }

  const { error: upDeal } = await db
    .from('Deal')
    .update({
      title,
      clientId,
      talentId,
      commissionRate: String(commissionRate),
      currency,
      stage,
    })
    .eq('id', dealId)
  if (upDeal) throw upDeal

  const { data: existingMilestones } = await db.from('Milestone').select('id, status').eq('dealId', dealId)

  const milestoneIdsToKeep = milestones.filter((m) => m.id).map((m) => m.id!)
  const milestonesToDelete = (existingMilestones ?? []).filter(
    (ex) => !milestoneIdsToKeep.includes(ex.id) && ex.status === 'PENDING',
  )

  if (milestonesToDelete.length > 0) {
    const { error: delErr } = await db
      .from('Milestone')
      .delete()
      .in(
        'id',
        milestonesToDelete.map((m) => m.id),
      )
    if (delErr) throw delErr
  }

  for (const m of milestones) {
    if (m.id) {
      const { error } = await db
        .from('Milestone')
        .update({
          description: m.description,
          grossAmount: String(m.grossAmount),
          invoiceDate: m.invoiceDate.slice(0, 10),
        })
        .eq('id', m.id)
        .eq('status', 'PENDING')
      if (error) throw new Error(error.message)
    } else {
      const { error } = await db.from('Milestone').insert({
        dealId,
        description: m.description,
        grossAmount: String(m.grossAmount),
        invoiceDate: m.invoiceDate.slice(0, 10),
        status: 'PENDING',
      })
      if (error) throw new Error(error.message)
    }
  }

  revalidatePath(`/agency/pipeline/${dealId}`)
  revalidatePath('/agency/pipeline')
  return { success: true }
}

export async function updateDealStage(
  dealId: string,
  stage: DealStage,
  options?: { acknowledgedWarningIds?: string[] },
) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()
  const { data: existingDeal, error } = await db
    .from('Deal')
    .select('agencyId, stage')
    .eq('id', dealId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!existingDeal) {
    throw new Error('Deal not found in your agency.')
  }
  if (stage === 'IN_BILLING' || stage === 'COMPLETED') {
    throw new Error('IN BILLING and COMPLETED are system-controlled stages.')
  }
  assertValidStageTransition(existingDeal.stage as DealStage, stage)
  if (existingDeal.stage !== 'ACTIVE' && stage === 'ACTIVE') {
    const checklist = await getDealActivationReadiness(dealId)
    const hardBlocks = checklist.filter((item) => item.status === 'block')
    if (hardBlocks.length > 0) {
      throw new Error(`Readiness gate failed: ${hardBlocks.map((item) => item.message).join(' ')}`)
    }
    const warningIds = checklist.filter((item) => item.status === 'warn').map((item) => item.id)
    const acknowledged = new Set(options?.acknowledgedWarningIds ?? [])
    const unacknowledgedWarnings = warningIds.filter((id) => !acknowledged.has(id))
    if (unacknowledgedWarnings.length > 0) {
      throw new Error('Readiness warnings must be acknowledged before activation.')
    }
  }
  const { error: up } = await db
    .from('Deal')
    .update({
      stage,
      probability: DEFAULT_STAGE_PROBABILITY[stage],
    })
    .eq('id', dealId)
  if (up) throw up
  revalidatePath('/agency/pipeline')
  revalidatePath(`/agency/pipeline/${dealId}`)
  return { success: true }
}

export async function updateDealProbability(dealId: string, probability: number) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const db = getSupabaseServiceRole()
  const { data: deal, error } = await db
    .from('Deal')
    .select('id, agencyId, stage')
    .eq('id', dealId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!deal) {
    throw new Error('Deal not found in your agency.')
  }
  if (deal.stage === 'ACTIVE' || deal.stage === 'COMPLETED') {
    throw new Error('Probability is locked once a deal is ACTIVE.')
  }

  const normalized = Math.max(0, Math.min(100, Math.round(probability)))
  const { error: up } = await db.from('Deal').update({ probability: normalized }).eq('id', dealId)
  if (up) throw up

  revalidatePath('/agency/pipeline')
  return { success: true, probability: normalized }
}
