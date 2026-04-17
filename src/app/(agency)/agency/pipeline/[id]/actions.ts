'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getAgencySessionContext } from '@/lib/agencyAuth'

export async function markMilestoneComplete(milestoneId: string) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  // Use transaction to ensure data integrity
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch the milestone with deal, client, and agency relations
    const milestone = await tx.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        deal: {
          include: {
            agency: {
              select: {
                id: true,
                vatRegistered: true,
                invoicingModel: true,
              },
            },
            client: true,
            talent: true,
          }
        }
      }
    })

    if (!milestone) throw new Error('Milestone not found')
    if (milestone.status !== 'PENDING') throw new Error('Milestone is not PENDING')
    if (milestone.deal.agencyId !== context.agencyId) throw new Error('Milestone not found in your agency')
    
    // 1.5 Fetch all approved, rechargeable expenses for this deal that haven't been invoiced yet
    const billableExpenses = await tx.dealExpense.findMany({
      where: {
        dealId: milestone.dealId,
        rechargeable: true,
        status: 'APPROVED',
        invoicedOnInvId: null
      }
    })

    const totalBillableExpenses = billableExpenses.reduce((acc, e) => acc + Number(e.amount), 0)

    // 2. Perform VAT calculations
    const baseGross = Number(milestone.grossAmount)
    const commissionRate = Number(milestone.deal.commissionRate)
    
    const agencyVat = milestone.deal.agency.vatRegistered
    const talentVat = milestone.deal.talent.vatRegistered
    const invoicingModel = milestone.deal.agency.invoicingModel

    // Calculate base commission (Expenses don't increase commission usually, they are recharges)
    const baseCommission = baseGross * (commissionRate / 100)

    // Calculate COM invoice gross (Agency -> Talent)
    const comVatAmount = agencyVat ? baseCommission * 0.20 : 0
    const comGross = baseCommission + comVatAmount

    let grossAmountToSave: number
    let netPayoutAmountToSave: number

    if (invoicingModel === 'SELF_BILLING') {
      // Client invoice (INV)
      // INV gross = (Milestone Gross + Expenses Gross) + VAT on that total if agency is registered
      const invTotalBeforeVat = baseGross + totalBillableExpenses
      const invVatAmount = agencyVat ? invTotalBeforeVat * 0.20 : 0
      const invGross = invTotalBeforeVat + invVatAmount

      // Supplier invoice (SBI)
      // SBI gross = Milestone Gross + VAT on milestone if talent is registered
      const sbiVatAmount = talentVat ? baseGross * 0.20 : 0
      const sbiGross = baseGross + sbiVatAmount

      grossAmountToSave = invGross
      // Payout = What talent is owed (SBI gross) minus what agency deducts (COM gross)
      netPayoutAmountToSave = sbiGross - comGross
    } else {
      // Client invoice (OBI, on behalf of talent)
      // OBI gross = Milestone Gross + Expenses + VAT on both if talent is registered? 
      // Usually recharges are handled as disbursements or agency-level recharges.
      // For MVP: Milestone + Expenses + VAT
      const obiTotalBeforeVat = baseGross + totalBillableExpenses
      const obiVatAmount = talentVat ? obiTotalBeforeVat * 0.20 : 0
      const obiGross = obiTotalBeforeVat + obiVatAmount

      grossAmountToSave = obiGross
      // Payout = What client paid (OBI gross) minus what agency deducts (COM gross)
      netPayoutAmountToSave = obiGross - comGross
    }

    const paymentTermsDays = milestone.deal.paymentTermsDays ?? milestone.deal.client.paymentTermsDays
    
    // Short ID for references
    const shortId = milestone.id.split('-')[0].toUpperCase()

    // Base properties for the InvoiceTriplet
    const tripletData: any = {
      milestoneId: milestone.id,
      invoicingModel: invoicingModel,
      comNumber: `COM-${shortId}`,
      grossAmount: grossAmountToSave,
      commissionRate: commissionRate,
      commissionAmount: comGross,
      netPayoutAmount: netPayoutAmountToSave,
      invoiceDate: milestone.invoiceDate,
      invDueDateDays: paymentTermsDays,
      approvalStatus: 'PENDING',
    }

    // Assign specific document numbers based on invoicing model
    if (invoicingModel === 'SELF_BILLING') {
      tripletData.invNumber = `INV-${shortId}`
      tripletData.sbiNumber = `SBI-${shortId}`
    } else if (invoicingModel === 'ON_BEHALF') {
      tripletData.obiNumber = `OBI-${shortId}`
      tripletData.cnNumber = `CN-${shortId}`
    }

    // 3. Update the milestone status
    await tx.milestone.update({
      where: { id: milestoneId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date()
      }
    })

    // 4. Create the InvoiceTriplet
    const triplet = await tx.invoiceTriplet.create({
      data: tripletData
    })

    // Move deal into system-controlled billing stage once invoicing is triggered.
    await tx.deal.update({
      where: { id: milestone.dealId },
      data: { stage: 'IN_BILLING', probability: 100 },
    })

    // 5. Link and Update Expenses
    if (billableExpenses.length > 0) {
      await tx.dealExpense.updateMany({
        where: { id: { in: billableExpenses.map(e => e.id) } },
        data: {
          status: 'INVOICED',
          invoicedOnInvId: triplet.id
        }
      })
    }

    // Revalidate the deal page to show the new status and Invoice Data block
    revalidatePath(`/agency/pipeline/${milestone.dealId}`)

    return { success: true }

  })
}

export async function addExpense(formData: {
  dealId: string
  agencyId: string
  description: string
  category: any
  amount: number
  currency: string
  rechargeable: boolean
  contractSignOff: boolean
  incurredBy: any
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  if (formData.agencyId !== context.agencyId) {
    throw new Error('Unauthorized agency context.')
  }

  const deal = await prisma.deal.findUnique({
    where: { id: formData.dealId },
    select: { agencyId: true },
  })
  if (!deal || deal.agencyId !== context.agencyId) {
    throw new Error('Deal not found in your agency.')
  }

  const expense = await prisma.dealExpense.create({
    data: {
      ...formData,
      status: 'APPROVED', // Auto-approve for MVP as discussed
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })

  revalidatePath(`/agency/pipeline/${formData.dealId}`)
  return { success: true, id: expense.id }
}

export async function updateDealWorkspace(input: {
  dealId: string
  notes: string
  contractRef: string
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    select: { agencyId: true },
  })
  if (!deal || deal.agencyId !== context.agencyId) {
    throw new Error('Deal not found in your agency.')
  }

  await prisma.deal.update({
    where: { id: input.dealId },
    data: {
      notes: input.notes.trim() || null,
      contractRef: input.contractRef.trim() || null,
    },
  })

  revalidatePath(`/agency/pipeline/${input.dealId}`)
  return { success: true }
}

export async function createDeliverable(input: {
  milestoneId: string
  title: string
  dueDate?: string
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const milestone = await prisma.milestone.findUnique({
    where: { id: input.milestoneId },
    select: { id: true, dealId: true, deal: { select: { agencyId: true } } },
  })
  if (!milestone || milestone.deal.agencyId !== context.agencyId) {
    throw new Error('Milestone not found in your agency.')
  }

  await prisma.deliverable.create({
    data: {
      milestoneId: input.milestoneId,
      title: input.title.trim(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: 'PENDING',
    },
  })

  revalidatePath(`/agency/pipeline/${milestone.dealId}`)
  return { success: true }
}

export async function updateDeliverableStatus(input: {
  deliverableId: string
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED'
}) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      milestone: {
        select: {
          dealId: true,
          deal: { select: { agencyId: true } },
        },
      },
    },
  })
  if (!deliverable || deliverable.milestone.deal.agencyId !== context.agencyId) {
    throw new Error('Deliverable not found in your agency.')
  }

  await prisma.deliverable.update({
    where: { id: input.deliverableId },
    data: { status: input.status },
  })

  revalidatePath(`/agency/pipeline/${deliverable.milestone.dealId}`)
  return { success: true }
}

