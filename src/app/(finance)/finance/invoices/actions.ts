'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { pushInvoiceTripletToXero, pushObiCreditNoteToXero, pushSelfBillingCreditNotesToXero } from '@/lib/xero-sync'
import { assertInvoiceTripletInAgency, requireFinanceUserContext } from '@/lib/financeAuth'
import { buildXeroContactSyncPreview, getAgencyXeroContextForUser } from '@/lib/xero-contact-sync'

export async function approveInvoiceTriplet(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '').trim()
  const recipientContactEmail = String(formData.get('recipientContactEmail') ?? '').trim()
  if (!tripletId) {
    throw new Error('Missing invoice triplet id')
  }

  const recipientContext = await prisma.invoiceTriplet.findFirst({
    where: {
      id: tripletId,
      milestone: { deal: { agencyId } },
    },
    select: {
      milestone: {
        select: {
          deal: {
            select: {
              client: {
                select: {
                  contacts: {
                    select: { name: true, email: true, role: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!recipientContext) {
    throw new Error('Invoice not found or not in your agency')
  }

  const clientContacts = recipientContext.milestone.deal.client.contacts
  const selectedRecipient =
    clientContacts.find((contact) => contact.email.toLowerCase() === recipientContactEmail.toLowerCase()) ??
    clientContacts.find((contact) => contact.role === 'FINANCE') ??
    clientContacts.find((contact) => contact.role === 'PRIMARY') ??
    clientContacts[0] ??
    null

  try {
    const xeroContext = await getAgencyXeroContextForUser(actorUserId)
    const syncPreview = await buildXeroContactSyncPreview(xeroContext)
    const conflictsCount =
      syncPreview.talent.filter((row) => row.action === 'CONFLICT').length +
      syncPreview.clients.filter((row) => row.action === 'CONFLICT').length
    if (conflictsCount > 0) {
      throw new Error(`Resolve ${conflictsCount} Xero contact sync conflict(s) before approving and pushing invoices.`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unable to validate Xero sync preflight. Resolve Xero sync setup before approving.')
  }

  try {
    await pushInvoiceTripletToXero({ tripletId, expectedAgencyId: agencyId })
  } catch (error) {
    console.error('[XERO PUSH] Invoice triplet push failed', {
      tripletId,
      error,
    })
    throw new Error('Invoice approved, but Xero push failed. Check Xero connection and retry.')
  }

  await prisma.$transaction(async (tx) => {
    const triplet = await tx.invoiceTriplet.update({
      where: { id: tripletId },
      data: {
        approvalStatus: 'APPROVED',
        issuedAt: new Date(),
        recipientContactName: selectedRecipient?.name ?? null,
        recipientContactEmail: selectedRecipient?.email ?? recipientContactEmail ?? null,
        recipientContactRole: selectedRecipient?.role ?? null,
      },
      select: {
        milestoneId: true,
        milestone: {
          select: {
            dealId: true,
          },
        },
      },
    })

    await tx.milestone.update({
      where: { id: triplet.milestoneId },
      data: { status: 'INVOICED' },
    })

    await tx.deal.update({
      where: { id: triplet.milestone.dealId },
      data: { stage: 'IN_BILLING', probability: 100 },
    })

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: 'INVOICE_RECIPIENT_SELECTED',
        targetType: 'INVOICE_TRIPLET',
        targetId: tripletId,
        metadata: {
          recipientContactName: selectedRecipient?.name ?? null,
          recipientContactEmail: selectedRecipient?.email ?? recipientContactEmail ?? null,
          recipientContactRole: selectedRecipient?.role ?? null,
        },
      },
    })
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/overdue')
  revalidatePath('/finance/dashboard')
  revalidatePath('/agency/pipeline')
}

export async function rejectInvoiceTriplet(tripletId: string) {
  const { agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  await assertInvoiceTripletInAgency(tripletId, agencyId)

  await prisma.invoiceTriplet.update({
    where: { id: tripletId },
    data: {
      approvalStatus: 'REJECTED',
    },
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/dashboard')
}

export async function amendInvoiceDraft(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '')
  const invoiceDateRaw = String(formData.get('invoiceDate') ?? '').trim()
  const grossAmountRaw = String(formData.get('grossAmount') ?? '').trim()
  const invDueDateDaysRaw = String(formData.get('invDueDateDays') ?? '').trim()
  const poNumber = String(formData.get('poNumber') ?? '').trim()
  const invoiceNarrative = String(formData.get('invoiceNarrative') ?? '').trim()
  const invoiceAddress = String(formData.get('invoiceAddress') ?? '').trim()

  if (!tripletId || !invoiceDateRaw || !grossAmountRaw) {
    throw new Error('Missing invoice amendment fields')
  }

  const grossAmount = Number(grossAmountRaw)
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new Error('Gross amount must be greater than zero')
  }

  const invoiceDate = new Date(invoiceDateRaw)
  if (Number.isNaN(invoiceDate.getTime())) {
    throw new Error('Invalid invoice date')
  }

  const invDueDateDays = Number(invDueDateDaysRaw)
  if (!Number.isInteger(invDueDateDays) || invDueDateDays < 0 || invDueDateDays > 365) {
    throw new Error('Payment terms (due days) must be a whole number between 0 and 365')
  }

  await prisma.$transaction(async (tx) => {
    const triplet = await tx.invoiceTriplet.findFirst({
      where: {
        id: tripletId,
        milestone: { deal: { agencyId } },
      },
      select: {
        id: true,
        milestoneId: true,
        approvalStatus: true,
        invoiceDate: true,
        grossAmount: true,
        commissionRate: true,
        invDueDateDays: true,
      },
    })

    if (!triplet) {
      throw new Error('Invoice triplet not found or not in your agency')
    }
    if (triplet.approvalStatus !== 'PENDING') {
      throw new Error('Only pending invoice drafts can be amended')
    }

    const commissionRate = Number(triplet.commissionRate)
    const commissionAmount = Number((grossAmount * (commissionRate / 100)).toFixed(2))
    const netPayoutAmount = Number((grossAmount - commissionAmount).toFixed(2))

    await tx.invoiceTriplet.update({
      where: { id: triplet.id },
      data: {
        invoiceDate,
        grossAmount,
        commissionAmount,
        netPayoutAmount,
        invDueDateDays,
        poNumber: poNumber || null,
        invoiceNarrative: invoiceNarrative || null,
        invoiceAddress: invoiceAddress || null,
      },
    })

    await tx.milestone.update({
      where: { id: triplet.milestoneId },
      data: {
        invoiceDate,
        grossAmount,
      },
    })

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: 'INVOICE_DRAFT_AMENDED',
        targetType: 'INVOICE_TRIPLET',
        targetId: triplet.id,
        metadata: {
          before: {
            invoiceDate: triplet.invoiceDate,
            grossAmount: Number(triplet.grossAmount),
          },
          after: {
            invoiceDate,
            grossAmount,
            commissionAmount,
            netPayoutAmount,
            invDueDateDays,
            poNumber: poNumber || null,
            invoiceNarrative: invoiceNarrative || null,
            invoiceAddress: invoiceAddress || null,
          },
        },
      },
    })
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/deals')
  revalidatePath('/finance/dashboard')
}

export async function amendApprovedObiTriplet(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '')
  const grossAmountRaw = String(formData.get('grossAmount') ?? '').trim()
  const reasonRaw = String(formData.get('reason') ?? '').trim()
  const cnDateRaw = String(formData.get('cnDate') ?? '').trim()

  if (!tripletId || !grossAmountRaw || !reasonRaw || !cnDateRaw) {
    throw new Error('Missing approved OBI amendment fields')
  }

  const newGrossAmount = Number(grossAmountRaw)
  if (!Number.isFinite(newGrossAmount) || newGrossAmount <= 0) {
    throw new Error('Amended gross amount must be greater than zero')
  }

  const cnDate = new Date(cnDateRaw)
  if (Number.isNaN(cnDate.getTime())) {
    throw new Error('Invalid credit note date')
  }

  const triplet = await prisma.invoiceTriplet.findFirst({
    where: {
      id: tripletId,
      milestone: { deal: { agencyId } },
    },
    select: {
      id: true,
      milestoneId: true,
      invoicingModel: true,
      approvalStatus: true,
      grossAmount: true,
      commissionRate: true,
      cnNumber: true,
      xeroObiId: true,
      manualCreditNotes: {
        select: {
          id: true,
          cnNumber: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      milestone: {
        select: {
          deal: {
            select: {
              id: true,
              agencyId: true,
            },
          },
        },
      },
    },
  })

  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }
  if (triplet.invoicingModel !== 'ON_BEHALF') {
    throw new Error('Approved amendment + CN is currently supported for OBI triplets only')
  }
  if (triplet.approvalStatus !== 'APPROVED') {
    throw new Error('Only approved OBI triplets can enter the CN amendment flow')
  }
  if (!triplet.xeroObiId) {
    throw new Error('Cannot raise CN before OBI has been pushed to Xero')
  }

  const oldGrossAmount = Number(triplet.grossAmount)
  if (newGrossAmount >= oldGrossAmount) {
    throw new Error('Amended gross must be lower than current gross to raise a credit note')
  }

  const cnAmount = Number((oldGrossAmount - newGrossAmount).toFixed(2))
  const commissionRate = Number(triplet.commissionRate)
  const amendedCommissionAmount = Number((newGrossAmount * (commissionRate / 100)).toFixed(2))
  const amendedNetPayoutAmount = Number((newGrossAmount - amendedCommissionAmount).toFixed(2))
  const reason = reasonRaw.slice(0, 500)
  const nextCnOrdinal = triplet.manualCreditNotes.length + 1
  const cnCandidate = `${triplet.cnNumber ?? `CN-${triplet.id.slice(0, 8).toUpperCase()}`}-${String(nextCnOrdinal).padStart(2, '0')}`

  let cnPushResult: { xeroCnId: string | null; xeroCnNumber: string | null }
  try {
    cnPushResult = await pushObiCreditNoteToXero({
      tripletId: triplet.id,
      amount: cnAmount,
      reason,
      creditDate: cnDate,
      cnNumber: cnCandidate,
      expectedAgencyId: agencyId,
    })
  } catch (error) {
    console.error('[XERO PUSH] OBI credit note push failed', {
      tripletId,
      error,
    })
    throw new Error('OBI amended, but CN push to Xero failed. Check Xero connection and retry.')
  }
  if (!cnPushResult.xeroCnId) {
    throw new Error('Credit note push did not return a Xero CN id. Please retry.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceTriplet.update({
      where: { id: triplet.id },
      data: {
        grossAmount: newGrossAmount,
        commissionAmount: amendedCommissionAmount,
        netPayoutAmount: amendedNetPayoutAmount,
        xeroCnId: cnPushResult.xeroCnId ?? undefined,
      },
    })

    await tx.milestone.update({
      where: { id: triplet.milestoneId },
      data: {
        grossAmount: newGrossAmount,
      },
    })

    await tx.manualCreditNote.create({
      data: {
        invoiceTripletId: triplet.id,
        agencyId: triplet.milestone.deal.agencyId,
        createdByUserId: actorUserId,
        cnNumber: cnPushResult.xeroCnNumber ?? cnCandidate,
        cnDate,
        amount: cnAmount,
        reason,
        xeroCnId: cnPushResult.xeroCnId ?? undefined,
      },
    })

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: 'OBI_CREDIT_NOTE_RAISED',
        targetType: 'INVOICE_TRIPLET',
        targetId: triplet.id,
        metadata: {
          before: {
            grossAmount: oldGrossAmount,
          },
          after: {
            grossAmount: newGrossAmount,
            commissionAmount: amendedCommissionAmount,
            netPayoutAmount: amendedNetPayoutAmount,
          },
          creditNote: {
            amount: cnAmount,
            reason,
            cnDate,
            xeroCnId: cnPushResult.xeroCnId,
            cnNumber: cnPushResult.xeroCnNumber ?? cnCandidate,
            cycle: nextCnOrdinal,
          },
        },
      },
    })
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/deals')
  revalidatePath('/finance/credit-notes')
  revalidatePath('/finance/dashboard')
}

export async function amendApprovedInvoiceBody(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '').trim()
  const poNumber = String(formData.get('poNumber') ?? '').trim()
  const invoiceNarrative = String(formData.get('invoiceNarrative') ?? '').trim()
  const invoiceAddress = String(formData.get('invoiceAddress') ?? '').trim()

  if (!tripletId) {
    throw new Error('Missing triplet id')
  }

  await prisma.$transaction(async (tx) => {
    const triplet = await tx.invoiceTriplet.findFirst({
      where: {
        id: tripletId,
        milestone: { deal: { agencyId } },
      },
      select: {
        id: true,
        approvalStatus: true,
        invPaidAt: true,
        poNumber: true,
        invoiceNarrative: true,
        invoiceAddress: true,
      },
    })

    if (!triplet) {
      throw new Error('Invoice triplet not found or not in your agency')
    }
    if (triplet.approvalStatus !== 'APPROVED') {
      throw new Error('Only approved invoices can be amended here')
    }
    if (triplet.invPaidAt) {
      throw new Error('Invoice body is locked once invoice is marked as paid')
    }

    await tx.invoiceTriplet.update({
      where: { id: triplet.id },
      data: {
        poNumber: poNumber || null,
        invoiceNarrative: invoiceNarrative || null,
        invoiceAddress: invoiceAddress || null,
      },
    })

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: 'APPROVED_INVOICE_BODY_AMENDED',
        targetType: 'INVOICE_TRIPLET',
        targetId: triplet.id,
        metadata: {
          before: {
            poNumber: triplet.poNumber,
            invoiceNarrative: triplet.invoiceNarrative,
            invoiceAddress: triplet.invoiceAddress,
          },
          after: {
            poNumber: poNumber || null,
            invoiceNarrative: invoiceNarrative || null,
            invoiceAddress: invoiceAddress || null,
          },
        },
      },
    })
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/overdue')
  revalidatePath('/finance/dashboard')
}

export async function raiseCreditNoteAndReraiseTriplet(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '').trim()
  const reasonRaw = String(formData.get('reason') ?? '').trim()
  const cnDateRaw = String(formData.get('cnDate') ?? '').trim()
  const replacementInvoiceDateRaw = String(formData.get('replacementInvoiceDate') ?? '').trim()
  const replacementGrossAmountRaw = String(formData.get('replacementGrossAmount') ?? '').trim()

  if (!tripletId || !reasonRaw || !cnDateRaw || !replacementInvoiceDateRaw || !replacementGrossAmountRaw) {
    throw new Error('Missing credit note re-raise fields')
  }

  const cnDate = new Date(cnDateRaw)
  if (Number.isNaN(cnDate.getTime())) {
    throw new Error('Invalid credit note date')
  }

  const replacementInvoiceDate = new Date(replacementInvoiceDateRaw)
  if (Number.isNaN(replacementInvoiceDate.getTime())) {
    throw new Error('Invalid replacement invoice date')
  }

  const replacementGrossAmount = Number(replacementGrossAmountRaw)
  if (!Number.isFinite(replacementGrossAmount) || replacementGrossAmount <= 0) {
    throw new Error('Replacement gross amount must be greater than zero')
  }

  const triplet = await prisma.invoiceTriplet.findFirst({
    where: {
      id: tripletId,
      milestone: { deal: { agencyId } },
    },
    include: {
      milestone: {
        include: {
          deal: {
            include: {
              agency: true,
              client: true,
              talent: true,
            },
          },
        },
      },
      manualCreditNotes: {
        select: { id: true },
      },
    },
  })

  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }
  if (triplet.approvalStatus !== 'APPROVED') {
    throw new Error('Only approved invoices can be credit-noted and re-raised')
  }
  if (triplet.invPaidAt) {
    throw new Error('Cannot credit-note and re-raise after invoice is paid')
  }
  if (triplet.milestone.status === 'CANCELLED') {
    throw new Error('This milestone has already been cancelled')
  }

  const oldGrossAmount = Number(triplet.grossAmount)
  const reason = reasonRaw.slice(0, 500)
  const cycle = triplet.manualCreditNotes.length + 1
  const cnNumberBase =
    triplet.cnNumber ??
    triplet.obiNumber ??
    triplet.invNumber ??
    `MCN-${triplet.id.slice(0, 8).toUpperCase()}`
  const cnCandidate = `${cnNumberBase}-${String(cycle).padStart(2, '0')}`

  let xeroCnResult: {
    xeroCnId: string | null
    xeroCnNumber: string | null
    xeroSbiCnId?: string | null
    xeroSbiCnNumber?: string | null
    xeroComCnId?: string | null
    xeroComCnNumber?: string | null
  } = {
    xeroCnId: null,
    xeroCnNumber: null,
  }

  if (triplet.invoicingModel === 'ON_BEHALF' && triplet.xeroObiId) {
    xeroCnResult = await pushObiCreditNoteToXero({
      tripletId: triplet.id,
      amount: oldGrossAmount,
      reason,
      creditDate: cnDate,
      cnNumber: cnCandidate,
      expectedAgencyId: agencyId,
    })
  } else if (triplet.invoicingModel === 'SELF_BILLING' && (triplet.xeroInvId || triplet.xeroSbiId || triplet.xeroComId)) {
    const selfBillingCnResult = await pushSelfBillingCreditNotesToXero({
      tripletId: triplet.id,
      reason,
      creditDate: cnDate,
      cnNumber: cnCandidate,
      expectedAgencyId: agencyId,
    })
    xeroCnResult = {
      xeroCnId: selfBillingCnResult.xeroInvCnId ?? selfBillingCnResult.xeroComCnId ?? selfBillingCnResult.xeroSbiCnId,
      xeroCnNumber:
        selfBillingCnResult.xeroInvCnNumber ?? selfBillingCnResult.xeroComCnNumber ?? selfBillingCnResult.xeroSbiCnNumber,
      xeroSbiCnId: selfBillingCnResult.xeroSbiCnId,
      xeroSbiCnNumber: selfBillingCnResult.xeroSbiCnNumber,
      xeroComCnId: selfBillingCnResult.xeroComCnId,
      xeroComCnNumber: selfBillingCnResult.xeroComCnNumber,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: triplet.milestoneId },
      data: {
        status: 'CANCELLED',
        cancelledByTripletId: triplet.id,
      },
    })

    const replacementMilestone = await tx.milestone.create({
      data: {
        dealId: triplet.milestone.dealId,
        description: triplet.milestone.description,
        grossAmount: replacementGrossAmount,
        invoiceDate: replacementInvoiceDate,
        deliveryDueDate: triplet.milestone.deliveryDueDate,
        status: 'COMPLETE',
        completedAt: new Date(),
        payoutStatus: 'PENDING',
        replacedCancelledMilestoneId: triplet.milestoneId,
      },
    })

    const shortId = replacementMilestone.id.split('-')[0].toUpperCase()
    const commissionRate = Number(triplet.commissionRate)
    const commissionAmount = Number((replacementGrossAmount * (commissionRate / 100)).toFixed(2))
    const netPayoutAmount = Number((replacementGrossAmount - commissionAmount).toFixed(2))

    const replacementTriplet = await tx.invoiceTriplet.create({
      data: {
        milestoneId: replacementMilestone.id,
        invoicingModel: triplet.invoicingModel,
        invNumber: triplet.invoicingModel === 'SELF_BILLING' ? `INV-${shortId}` : null,
        sbiNumber: triplet.invoicingModel === 'SELF_BILLING' ? `SBI-${shortId}` : null,
        obiNumber: triplet.invoicingModel === 'ON_BEHALF' ? `OBI-${shortId}` : null,
        cnNumber: triplet.invoicingModel === 'ON_BEHALF' ? `CN-${shortId}` : null,
        comNumber: `COM-${shortId}`,
        grossAmount: replacementGrossAmount,
        commissionRate,
        commissionAmount,
        netPayoutAmount,
        invoiceDate: replacementInvoiceDate,
        invDueDateDays: triplet.invDueDateDays,
        approvalStatus: 'PENDING',
        poNumber: triplet.poNumber,
        invoiceNarrative: triplet.invoiceNarrative,
        invoiceAddress: triplet.invoiceAddress,
      },
      select: { id: true },
    })

    await tx.manualCreditNote.create({
      data: {
        invoiceTripletId: triplet.id,
        agencyId: triplet.milestone.deal.agencyId,
        createdByUserId: actorUserId,
        cnNumber: xeroCnResult.xeroCnNumber ?? cnCandidate,
        cnDate,
        amount: oldGrossAmount,
        reason,
        xeroCnId: xeroCnResult.xeroCnId ?? undefined,
        requiresReplacement: true,
        replacementMilestoneId: replacementMilestone.id,
      },
    })

    if (xeroCnResult.xeroCnId) {
      await tx.invoiceTriplet.update({
        where: { id: triplet.id },
        data: {
          xeroCnId: xeroCnResult.xeroCnId,
        },
      })
    }

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: 'INVOICE_CREDIT_NOTED_RERAISED',
        targetType: 'INVOICE_TRIPLET',
        targetId: triplet.id,
        metadata: {
          creditNote: {
            cnNumber: xeroCnResult.xeroCnNumber ?? cnCandidate,
            cnDate,
            amount: oldGrossAmount,
            reason,
            xeroCnId: xeroCnResult.xeroCnId,
            xeroSbiCnId: xeroCnResult.xeroSbiCnId ?? null,
            xeroSbiCnNumber: xeroCnResult.xeroSbiCnNumber ?? null,
            xeroComCnId: xeroCnResult.xeroComCnId ?? null,
            xeroComCnNumber: xeroCnResult.xeroComCnNumber ?? null,
          },
          original: {
            tripletId: triplet.id,
            milestoneId: triplet.milestoneId,
            grossAmount: oldGrossAmount,
          },
          replacement: {
            milestoneId: replacementMilestone.id,
            tripletId: replacementTriplet.id,
            grossAmount: replacementGrossAmount,
            invoiceDate: replacementInvoiceDate,
          },
        },
      },
    })
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/deals')
  revalidatePath('/finance/credit-notes')
  revalidatePath('/finance/dashboard')
}
