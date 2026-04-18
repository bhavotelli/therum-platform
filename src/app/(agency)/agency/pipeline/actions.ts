'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAgencySessionContext } from '@/lib/agencyAuth'
import { DealStage } from '@prisma/client'

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

  // Only allow one-step transitions in either direction.
  if (Math.abs(targetIndex - currentIndex) > 1) {
    throw new Error(`Invalid stage transition: ${current} -> ${target}. Move one stage at a time.`)
  }
}

export async function getDealActivationReadiness(dealId: string): Promise<ReadinessCheckItem[]> {
  const context = await getAgencySessionContext()
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, agencyId: context.agencyId },
    include: {
      agency: {
        select: {
          id: true,
          invoicingModel: true,
        },
      },
      client: {
        select: {
          contacts: {
            select: { role: true },
          },
        },
      },
      talent: {
        select: { xeroContactId: true },
      },
      milestones: {
        select: {
          id: true,
          grossAmount: true,
          invoiceDate: true,
          _count: {
            select: {
              deliverables: true,
            },
          },
        },
      },
    },
  })

  if (!deal) {
    throw new Error('Deal not found.')
  }

  const invalidMilestoneAmount = deal.milestones.some((m) => Number(m.grossAmount) <= 0)
  const missingInvoiceDates = deal.milestones.some((m) => !m.invoiceDate)
  const milestonesWithoutDeliverables = deal.milestones.some((m) => m._count.deliverables === 0)
  const hasFinanceContact = deal.client.contacts.some((c) => c.role === 'FINANCE')

  const checklist: ReadinessCheckItem[] = [
    {
      id: 'invoicing_model',
      status: deal.agency.invoicingModel ? 'pass' : 'block',
      message: deal.agency.invoicingModel
        ? 'Invoicing model is configured.'
        : 'Agency invoicing model is not configured.',
    },
    {
      id: 'milestones_exist',
      status: deal.milestones.length > 0 ? 'pass' : 'block',
      message: deal.milestones.length > 0 ? 'At least one milestone exists.' : 'At least one milestone is required.',
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
      status: deal.talent.xeroContactId ? 'pass' : 'block',
      message: deal.talent.xeroContactId
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

  const deal = await prisma.$transaction(async (tx) => {
    // 1. Create the deal
    const newDeal = await tx.deal.create({
      data: {
        agencyId,
        clientId,
        talentId,
        title,
        commissionRate,
        currency,
        stage: selectedStage,
        probability: DEFAULT_STAGE_PROBABILITY[selectedStage],
      }
    })

    // 2. Create the milestones
    if (milestones.length > 0) {
      await tx.milestone.createMany({
        data: milestones.map((m) => ({
          dealId: newDeal.id,
          description: m.description,
          grossAmount: m.grossAmount,
          invoiceDate: new Date(m.invoiceDate),
          status: 'PENDING',
        }))
      })
    }

    return newDeal
  })

  revalidatePath('/agency/pipeline')
  redirect(`/agency/pipeline/${deal.id}`)
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

  const existingDeal = await prisma.deal.findFirst({
    where: { id: dealId, agencyId: context.agencyId },
    select: { agencyId: true, stage: true },
  })
  if (!existingDeal) {
    throw new Error('Deal not found in your agency.')
  }
  if (stage === 'IN_BILLING' || stage === 'COMPLETED') {
    throw new Error('IN BILLING and COMPLETED are system-controlled stages.')
  }
  assertValidStageTransition(existingDeal.stage, stage)
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

  await prisma.$transaction(async (tx) => {
    // 1. Update deal metadata
    await tx.deal.update({
      where: { id: dealId },
      data: {
        title,
        clientId,
        talentId,
        commissionRate,
        currency,
        stage,
      }
    })

    // 2. Sync Milestones
    // Get existing milestones to handle deletions
    const existingMilestones = await tx.milestone.findMany({
      where: { dealId }
    })

    const milestoneIdsToKeep = milestones.filter(m => m.id).map(m => m.id!)
    const milestonesToDelete = existingMilestones.filter(
      ex => !milestoneIdsToKeep.includes(ex.id) && ex.status === 'PENDING'
    )

    // Delete removed milestones (only if PENDING)
    if (milestonesToDelete.length > 0) {
      await tx.milestone.deleteMany({
        where: { id: { in: milestonesToDelete.map(m => m.id) } }
      })
    }

    // Upsert remaining milestones
    for (const m of milestones) {
      if (m.id) {
        // Update existing (only if PENDING)
        // We check current status in the where clause to prevent accidental updates of locked milestones
        await tx.milestone.updateMany({
          where: { id: m.id, status: 'PENDING' },
          data: {
            description: m.description,
            grossAmount: m.grossAmount,
            invoiceDate: new Date(m.invoiceDate),
          }
        })
      } else {
        // Create new
        await tx.milestone.create({
          data: {
            dealId,
            description: m.description,
            grossAmount: m.grossAmount,
            invoiceDate: new Date(m.invoiceDate),
            status: 'PENDING',
          }
        })
      }
    }
  })

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
  const existingDeal = await prisma.deal.findFirst({
    where: { id: dealId, agencyId: context.agencyId },
    select: { agencyId: true, stage: true },
  })
  if (!existingDeal) {
    throw new Error('Deal not found in your agency.')
  }
  if (stage === 'IN_BILLING' || stage === 'COMPLETED') {
    throw new Error('IN BILLING and COMPLETED are system-controlled stages.')
  }
  assertValidStageTransition(existingDeal.stage, stage)
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
  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage,
      probability: DEFAULT_STAGE_PROBABILITY[stage],
    }
  })
  revalidatePath('/agency/pipeline')
  revalidatePath(`/agency/pipeline/${dealId}`)
  return { success: true }
}

export async function updateDealProbability(dealId: string, probability: number) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, agencyId: context.agencyId },
    select: { id: true, agencyId: true, stage: true },
  })
  if (!deal) {
    throw new Error('Deal not found in your agency.')
  }
  if (deal.stage === 'ACTIVE' || deal.stage === 'COMPLETED') {
    throw new Error('Probability is locked once a deal is ACTIVE.')
  }

  const normalized = Math.max(0, Math.min(100, Math.round(probability)))
  await prisma.deal.update({
    where: { id: dealId },
    data: { probability: normalized },
  })

  revalidatePath('/agency/pipeline')
  return { success: true, probability: normalized }
}


