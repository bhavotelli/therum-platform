'use server'

import { revalidatePath } from 'next/cache'

import { insertAdminAuditLog } from '@/lib/db/admin-audit-log'
import { wrapPostgrestError } from '@/lib/errors'
import { assertInvoiceTripletInAgency, requireFinanceUserContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { ContactRoles, type ContactRole } from '@/types/database'
import {
  pushInvoiceTripletToXero,
  pushObiCreditNoteToXero,
  pushSelfBillingCreditNotesToXero,
} from '@/lib/xero-sync'
import { buildXeroContactSyncPreview, getAgencyXeroContextForUser } from '@/lib/xero-contact-sync'

export async function approveInvoiceTriplet(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '').trim()
  const recipientContactEmail = String(formData.get('recipientContactEmail') ?? '').trim()
  if (!tripletId) {
    throw new Error('Missing invoice triplet id')
  }

  const db = getSupabaseServiceRole()
  const { data: trip0 } = await db
    .from('InvoiceTriplet')
    .select('milestoneId, xeroCleanupRequired, approvalStatus')
    .eq('id', tripletId)
    .maybeSingle()
  if (!trip0) throw new Error('Invoice not found or not in your agency')
  const { data: ms0 } = await db.from('Milestone').select('dealId').eq('id', trip0.milestoneId).maybeSingle()
  if (!ms0) throw new Error('Invoice not found or not in your agency')
  const { data: deal0 } = await db.from('Deal').select('clientId, agencyId').eq('id', ms0.dealId).maybeSingle()
  if (!deal0 || deal0.agencyId !== agencyId) {
    throw new Error('Invoice not found or not in your agency')
  }

  // Cheap double-submit guard. THE-48 made the post-Xero commit atomic
  // (complete_xero_push RPC) but does NOT lock the row at the start of the
  // push: two concurrent approvals can both read approvalStatus === 'PENDING'
  // before either writes and both enter the Xero push in parallel, each
  // creating a full set of Xero documents. The RPC's WHERE clause matches on
  // id + milestoneId only, so the second RPC overwrites the first and Xero is
  // left with duplicates. Tracked in THE-55: tighten the RPC to also match on
  // approvalStatus = 'PENDING' so a concurrent second call raises and falls
  // into the xeroCleanupRequired path.
  if (trip0.approvalStatus !== 'PENDING') {
    throw new Error('Invoice has already been processed and cannot be approved again')
  }

  if (trip0.xeroCleanupRequired) {
    throw new Error(
      'Xero cleanup required on this invoice — a previous push left orphaned documents in Xero. Void them in Xero, then clear the cleanup flag before retrying.'
    )
  }

  const { data: clientContacts } = await db
    .from('ClientContact')
    .select('name, email, role')
    .eq('clientId', deal0.clientId)
    .eq('agencyId', agencyId)

  const contacts = clientContacts ?? []
  const selectedRecipient =
    contacts.find((contact) => contact.email.toLowerCase() === recipientContactEmail.toLowerCase()) ??
    contacts.find((contact) => contact.role === 'FINANCE') ??
    contacts.find((contact) => contact.role === 'PRIMARY') ??
    contacts[0] ??
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
      throw new Error(error.message)
    }
    throw new Error('Unable to validate Xero sync preflight. Resolve Xero sync setup before approving.')
  }

  // Compute issuedAt before the push so it commits atomically with
  // approvalStatus='APPROVED' inside complete_xero_push. A DB-level trigger
  // (invoice_triplet_issued_at_immutable, THE-63) enforces immutability
  // afterwards — so this value cannot be changed by any subsequent UPDATE.
  const issuedAt = new Date().toISOString()
  try {
    await pushInvoiceTripletToXero({ tripletId, issuedAt, expectedAgencyId: agencyId })
  } catch (error) {
    console.error('[XERO PUSH] Invoice triplet push failed', {
      tripletId,
      error,
    })
    throw new Error('Invoice approved, but Xero push failed. Check Xero connection and retry.')
  }

  // approvalStatus='APPROVED', issuedAt, and Milestone.status='INVOICED' are
  // already committed atomically inside pushInvoiceTripletToXero via the
  // complete_xero_push RPC. Here we only persist the recipient metadata.
  const { data: triplet, error: upT } = await db
    .from('InvoiceTriplet')
    .update({
      recipientContactName: selectedRecipient?.name ?? null,
      recipientContactEmail: selectedRecipient?.email ?? recipientContactEmail ?? null,
      recipientContactRole: selectedRecipient?.role ?? null,
    })
    .eq('id', tripletId)
    .select('milestoneId')
    .single()
  if (upT) throw upT

  const { data: ms1 } = await db.from('Milestone').select('dealId').eq('id', triplet.milestoneId).maybeSingle()
  if (ms1) {
    const { error: upD } = await db
      .from('Deal')
      .update({ stage: 'IN_BILLING', probability: 100 })
      .eq('id', ms1.dealId)
      .eq('agencyId', agencyId)
    if (upD) throw upD
  }

  await insertAdminAuditLog({
    actorUserId,
    action: 'INVOICE_RECIPIENT_SELECTED',
    targetType: 'INVOICE_TRIPLET',
    targetId: tripletId,
    metadata: {
      recipientContactName: selectedRecipient?.name ?? null,
      recipientContactEmail: selectedRecipient?.email ?? recipientContactEmail ?? null,
      recipientContactRole: selectedRecipient?.role ?? null,
    },
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/overdue')
  revalidatePath('/finance/dashboard')
  revalidatePath('/agency/pipeline')
}

export async function clearXeroCleanupFlag(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const tripletId = String(formData.get('tripletId') ?? '').trim()
  // Require an explicit confirmation that orphaned Xero docs have been voided.
  // Cannot verify this against Xero directly without added API complexity, so
  // we require a deliberate click + audit log the attestation.
  //
  // Note: this confirmation is UI-only. A finance user could bypass it by
  // posting to the server action directly — Finance role is still required,
  // but we cannot verify the Xero void actually occurred. The audit log
  // records the attestation (confirmedVoidedByOperator) as an accountable
  // claim by the operator, not as Xero-verified truth.
  const confirmed = formData.get('confirmVoided') === 'on'
  if (!tripletId) {
    throw new Error('Missing invoice triplet id')
  }
  if (!confirmed) {
    throw new Error('Confirm that orphaned Xero documents have been voided before clearing the flag')
  }

  await assertInvoiceTripletInAgency(tripletId, agencyId)

  const db = getSupabaseServiceRole()
  const { data: triplet, error: qErr } = await db
    .from('InvoiceTriplet')
    .select(
      'xeroCleanupRequired, xeroInvId, xeroSbiId, xeroObiId, xeroCnId, xeroComId, invNumber, sbiNumber, obiNumber, cnNumber, comNumber'
    )
    .eq('id', tripletId)
    .maybeSingle()
  if (qErr) throw new Error(qErr.message)
  if (!triplet) throw new Error('Invoice not found or not in your agency')
  if (!triplet.xeroCleanupRequired) {
    throw new Error('Xero cleanup flag is not set on this invoice')
  }

  const partialXeroIds = {
    xeroInvId: triplet.xeroInvId,
    xeroSbiId: triplet.xeroSbiId,
    xeroObiId: triplet.xeroObiId,
    xeroCnId: triplet.xeroCnId,
    xeroComId: triplet.xeroComId,
  }
  const hasAnyXeroId = Object.values(partialXeroIds).some((id) => typeof id === 'string' && id.length > 0)
  if (!hasAnyXeroId) {
    // Anomaly: flag was set but no partial IDs recorded. Likely the partial-write
    // flag update in pushInvoiceTripletToXero itself failed after the Xero call,
    // or the row was manipulated externally. Audit-log the anomaly for forensic
    // trail before refusing to clear, so the investigation starts from a
    // concrete record rather than just a log line.
    await insertAdminAuditLog({
      actorUserId,
      action: 'XERO_CLEANUP_FLAG_ANOMALY_DETECTED',
      targetType: 'INVOICE_TRIPLET',
      targetId: tripletId,
      metadata: {
        reason: 'xeroCleanupRequired is true but no partial Xero IDs recorded on row',
        attemptedClearByUserId: actorUserId,
      },
    })
    throw new Error(
      'Cleanup flag is set but no partial Xero IDs were recorded on this triplet. Check server logs for the original push failure and any orphaned Xero documents before clearing.'
    )
  }

  const { error: upErr } = await db
    .from('InvoiceTriplet')
    .update({ xeroCleanupRequired: false })
    .eq('id', tripletId)
  if (upErr) throw new Error(upErr.message)

  await insertAdminAuditLog({
    actorUserId,
    action: 'XERO_CLEANUP_FLAG_CLEARED',
    targetType: 'INVOICE_TRIPLET',
    targetId: tripletId,
    metadata: {
      partialXeroIdsAtClearTime: partialXeroIds,
      partialRefsAtClearTime: {
        invNumber: triplet.invNumber,
        sbiNumber: triplet.sbiNumber,
        obiNumber: triplet.obiNumber,
        cnNumber: triplet.cnNumber,
        comNumber: triplet.comNumber,
      },
      confirmedVoidedByOperator: true,
    },
  })

  revalidatePath('/finance/invoices')
  revalidatePath(`/finance/invoices/${tripletId}`)
  revalidatePath('/finance/dashboard')
  revalidatePath('/agency/pipeline')
}

export async function rejectInvoiceTriplet(tripletId: string) {
  const { agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  await assertInvoiceTripletInAgency(tripletId, agencyId)

  const db = getSupabaseServiceRole()
  const { error } = await db.from('InvoiceTriplet').update({ approvalStatus: 'REJECTED' }).eq('id', tripletId)
  if (error) throw wrapPostgrestError(error)

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

  const db = getSupabaseServiceRole()
  const { data: triplet, error: qErr } = await db
    .from('InvoiceTriplet')
    .select('id, milestoneId, approvalStatus, invoiceDate, grossAmount, commissionRate, invDueDateDays')
    .eq('id', tripletId)
    .maybeSingle()

  if (qErr) throw wrapPostgrestError(qErr)
  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: ms0 } = await db.from('Milestone').select('dealId').eq('id', triplet.milestoneId).maybeSingle()
  const { data: deal0 } = await db.from('Deal').select('agencyId').eq('id', ms0?.dealId ?? '').maybeSingle()
  if (!deal0 || deal0.agencyId !== agencyId) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  if (triplet.approvalStatus !== 'PENDING') {
    throw new Error('Only pending invoice drafts can be amended')
  }

  const commissionRate = Number(triplet.commissionRate)
  const commissionAmount = Number((grossAmount * (commissionRate / 100)).toFixed(2))
  const netPayoutAmount = Number((grossAmount - commissionAmount).toFixed(2))

  const invDateStr = invoiceDate.toISOString().slice(0, 10)

  const { error: u1 } = await db
    .from('InvoiceTriplet')
    .update({
      invoiceDate: invDateStr,
      grossAmount: String(grossAmount),
      commissionAmount: String(commissionAmount),
      netPayoutAmount: String(netPayoutAmount),
      invDueDateDays,
      poNumber: poNumber || null,
      invoiceNarrative: invoiceNarrative || null,
      invoiceAddress: invoiceAddress || null,
    })
    .eq('id', triplet.id)
  if (u1) throw u1

  const { error: u2 } = await db
    .from('Milestone')
    .update({
      invoiceDate: invDateStr,
      grossAmount: String(grossAmount),
    })
    .eq('id', triplet.milestoneId)
  if (u2) throw u2

  await insertAdminAuditLog({
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
        invoiceDate: invDateStr,
        grossAmount,
        commissionAmount,
        netPayoutAmount,
        invDueDateDays,
        poNumber: poNumber || null,
        invoiceNarrative: invoiceNarrative || null,
        invoiceAddress: invoiceAddress || null,
      },
    },
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

  const db = getSupabaseServiceRole()
  const { data: triplet } = await db.from('InvoiceTriplet').select('*').eq('id', tripletId).maybeSingle()
  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: ms } = await db.from('Milestone').select('dealId').eq('id', triplet.milestoneId).maybeSingle()
  const { data: deal } = await db.from('Deal').select('agencyId').eq('id', ms?.dealId ?? '').maybeSingle()
  if (!deal || deal.agencyId !== agencyId) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: mcRows } = await db
    .from('ManualCreditNote')
    .select('id, cnNumber')
    .eq('invoiceTripletId', tripletId)
    .order('createdAt', { ascending: false })

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
  const nextCnOrdinal = (mcRows ?? []).length + 1
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

  const { error: u1 } = await db
    .from('InvoiceTriplet')
    .update({
      grossAmount: String(newGrossAmount),
      commissionAmount: String(amendedCommissionAmount),
      netPayoutAmount: String(amendedNetPayoutAmount),
      xeroCnId: cnPushResult.xeroCnId ?? undefined,
    })
    .eq('id', triplet.id)
  if (u1) throw u1

  const { error: u2 } = await db.from('Milestone').update({ grossAmount: String(newGrossAmount) }).eq('id', triplet.milestoneId)
  if (u2) throw u2

  const cnDateStr = cnDate.toISOString().slice(0, 10)
  const { error: mcnErr } = await db.from('ManualCreditNote').insert({
    invoiceTripletId: triplet.id,
    agencyId: deal.agencyId,
    createdByUserId: actorUserId,
    cnNumber: cnPushResult.xeroCnNumber ?? cnCandidate,
    cnDate: cnDateStr,
    amount: String(cnAmount),
    reason,
    xeroCnId: cnPushResult.xeroCnId ?? null,
  })
  if (mcnErr) throw wrapPostgrestError(mcnErr)

  await insertAdminAuditLog({
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
        cnDate: cnDateStr,
        xeroCnId: cnPushResult.xeroCnId,
        cnNumber: cnPushResult.xeroCnNumber ?? cnCandidate,
        cycle: nextCnOrdinal,
      },
    },
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
  const invDueDateDaysRaw = String(formData.get('invDueDateDays') ?? '').trim()
  const invDueDateDays = invDueDateDaysRaw !== '' ? parseInt(invDueDateDaysRaw, 10) : null

  if (!tripletId) {
    throw new Error('Missing triplet id')
  }

  if (invDueDateDays !== null && (isNaN(invDueDateDays) || invDueDateDays < 0)) {
    throw new Error('Payment terms must be a non-negative number of days')
  }

  const db = getSupabaseServiceRole()
  const { data: triplet } = await db
    .from('InvoiceTriplet')
    .select('id, approvalStatus, invPaidAt, poNumber, invoiceNarrative, invoiceAddress, invDueDateDays, milestoneId')
    .eq('id', tripletId)
    .maybeSingle()

  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: ms } = await db.from('Milestone').select('dealId').eq('id', triplet.milestoneId).maybeSingle()
  const { data: deal } = await db.from('Deal').select('agencyId').eq('id', ms?.dealId ?? '').maybeSingle()
  if (!deal || deal.agencyId !== agencyId) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  if (triplet.approvalStatus !== 'APPROVED') {
    throw new Error('Only approved invoices can be amended here')
  }
  if (triplet.invPaidAt) {
    throw new Error('Invoice body is locked once invoice is marked as paid')
  }

  const { error } = await db
    .from('InvoiceTriplet')
    .update({
      poNumber: poNumber || null,
      invoiceNarrative: invoiceNarrative || null,
      invoiceAddress: invoiceAddress || null,
      ...(invDueDateDays !== null ? { invDueDateDays } : {}),
    })
    .eq('id', triplet.id)
  if (error) throw wrapPostgrestError(error)

  await insertAdminAuditLog({
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

  const db = getSupabaseServiceRole()
  const { data: triplet } = await db.from('InvoiceTriplet').select('*').eq('id', tripletId).maybeSingle()
  if (!triplet) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: milestone } = await db.from('Milestone').select('*').eq('id', triplet.milestoneId).maybeSingle()
  if (!milestone) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: dealFull } = await db.from('Deal').select('*').eq('id', milestone.dealId).maybeSingle()
  if (!dealFull || dealFull.agencyId !== agencyId) {
    throw new Error('Invoice triplet not found or not in your agency')
  }

  const { data: mcList } = await db.from('ManualCreditNote').select('id').eq('invoiceTripletId', tripletId)

  if (triplet.approvalStatus !== 'APPROVED') {
    throw new Error('Only approved invoices can be credit-noted and re-raised')
  }
  if (triplet.invPaidAt) {
    throw new Error('Cannot credit-note and re-raise after invoice is paid')
  }
  if (milestone.status === 'CANCELLED') {
    throw new Error('This milestone has already been cancelled')
  }

  const oldGrossAmount = Number(triplet.grossAmount)
  const reason = reasonRaw.slice(0, 500)
  const cycle = (mcList ?? []).length + 1
  const cnNumberBase =
    triplet.cnNumber ?? triplet.obiNumber ?? triplet.invNumber ?? `MCN-${triplet.id.slice(0, 8).toUpperCase()}`
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

  const { error: c1 } = await db
    .from('Milestone')
    .update({
      status: 'CANCELLED',
      cancelledByTripletId: triplet.id,
    })
    .eq('id', triplet.milestoneId)
  if (c1) throw c1

  const replInvStr = replacementInvoiceDate.toISOString().slice(0, 10)
  const { data: replacementMilestone, error: cmErr } = await db
    .from('Milestone')
    .insert({
      dealId: milestone.dealId,
      description: milestone.description,
      grossAmount: String(replacementGrossAmount),
      invoiceDate: replInvStr,
      deliveryDueDate: milestone.deliveryDueDate,
      status: 'COMPLETE',
      completedAt: new Date().toISOString(),
      payoutStatus: 'PENDING',
      replacedCancelledMilestoneId: triplet.milestoneId,
    })
    .select('id')
    .single()
  if (cmErr) throw wrapPostgrestError(cmErr)

  const commissionRate = Number(triplet.commissionRate)
  const commissionAmount = Number((replacementGrossAmount * (commissionRate / 100)).toFixed(2))
  const netPayoutAmount = Number((replacementGrossAmount - commissionAmount).toFixed(2))

  const { data: replacementTriplet, error: rtErr } = await db
    .from('InvoiceTriplet')
    .insert({
      milestoneId: replacementMilestone.id,
      invoicingModel: triplet.invoicingModel,
      // Replacement triplet — reference numbers will be assigned by Xero when this new triplet is approved.
      invNumber: null,
      sbiNumber: null,
      obiNumber: null,
      cnNumber: null,
      comNumber: null,
      grossAmount: String(replacementGrossAmount),
      commissionRate: String(commissionRate),
      commissionAmount: String(commissionAmount),
      netPayoutAmount: String(netPayoutAmount),
      invoiceDate: replInvStr,
      invDueDateDays: triplet.invDueDateDays,
      approvalStatus: 'PENDING',
      poNumber: triplet.poNumber,
      invoiceNarrative: triplet.invoiceNarrative,
      invoiceAddress: triplet.invoiceAddress,
    })
    .select('id')
    .single()
  if (rtErr) throw wrapPostgrestError(rtErr)

  const cnDateStr = cnDate.toISOString().slice(0, 10)
  const { error: mcnErr } = await db.from('ManualCreditNote').insert({
    invoiceTripletId: triplet.id,
    agencyId: dealFull.agencyId,
    createdByUserId: actorUserId,
    cnNumber: xeroCnResult.xeroCnNumber ?? cnCandidate,
    cnDate: cnDateStr,
    amount: String(oldGrossAmount),
    reason,
    xeroCnId: xeroCnResult.xeroCnId ?? null,
    requiresReplacement: true,
    replacementMilestoneId: replacementMilestone.id,
  })
  if (mcnErr) throw wrapPostgrestError(mcnErr)

  if (xeroCnResult.xeroCnId) {
    const { error: ux } = await db.from('InvoiceTriplet').update({ xeroCnId: xeroCnResult.xeroCnId }).eq('id', triplet.id)
    if (ux) throw wrapPostgrestError(ux)
  }

  await insertAdminAuditLog({
    actorUserId,
    action: 'INVOICE_CREDIT_NOTED_RERAISED',
    targetType: 'INVOICE_TRIPLET',
    targetId: triplet.id,
    metadata: {
      creditNote: {
        cnNumber: xeroCnResult.xeroCnNumber ?? cnCandidate,
        cnDate: cnDateStr,
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
        invoiceDate: replInvStr,
      },
    },
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/finance/deals')
  revalidatePath('/finance/credit-notes')
  revalidatePath('/finance/dashboard')
}

export type CreateContactRequestResult = { alreadyOpen: boolean }

// THE-84: Finance asks the agency team to add a contact for a client that has
// none on file. Creates a ContactRequest row; auto-resolves via DB trigger
// when any ClientContact is later inserted for that client.
export async function createContactRequest(formData: FormData): Promise<CreateContactRequestResult> {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const clientId = String(formData.get('clientId') ?? '').trim()
  const requestedRoleRaw = String(formData.get('requestedRole') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim().slice(0, 500)

  if (!clientId) {
    throw new Error('Missing client id')
  }

  const requestedRole: ContactRole | null =
    requestedRoleRaw === ContactRoles.PRIMARY ||
    requestedRoleRaw === ContactRoles.FINANCE ||
    requestedRoleRaw === ContactRoles.OTHER
      ? requestedRoleRaw
      : null

  const db = getSupabaseServiceRole()

  // Tenant guard: confirm the client belongs to the finance user's agency.
  const { data: clientRow } = await db
    .from('Client')
    .select('id, agencyId, name')
    .eq('id', clientId)
    .maybeSingle()
  if (!clientRow || clientRow.agencyId !== agencyId) {
    throw new Error('Client not found or not in your agency')
  }

  // Idempotency: collapse to one OPEN request per (client, requester) so
  // mashing the button doesn't spam the agency inbox. Agency staff still see
  // a single banner; if the requester wants a different role hint they cancel
  // and re-submit.
  const { data: existing } = await db
    .from('ContactRequest')
    .select('id')
    .eq('clientId', clientId)
    .eq('requestedByUserId', actorUserId)
    .eq('status', 'OPEN')
    .limit(1)
    .maybeSingle()

  if (existing) {
    revalidatePath('/finance/invoices')
    return { alreadyOpen: true }
  }

  const { data: created, error } = await db
    .from('ContactRequest')
    .insert({
      agencyId,
      clientId,
      requestedByUserId: actorUserId,
      requestedRole,
      note: note || null,
    })
    .select('id')
    .single()
  if (error) throw wrapPostgrestError(error)

  await insertAdminAuditLog({
    actorUserId,
    action: 'CONTACT_REQUEST_CREATED',
    targetType: 'CONTACT_REQUEST',
    targetId: created.id,
    metadata: {
      clientId,
      clientName: clientRow.name,
      requestedRole,
      hasNote: Boolean(note),
    },
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/agency/clients')
  return { alreadyOpen: false }
}

// Finance can withdraw their own request before the agency adds a contact.
export async function cancelContactRequest(formData: FormData) {
  const { userId: actorUserId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })
  const requestId = String(formData.get('requestId') ?? '').trim()
  if (!requestId) {
    throw new Error('Missing request id')
  }

  const db = getSupabaseServiceRole()
  const { data: req } = await db
    .from('ContactRequest')
    .select('id, agencyId, requestedByUserId, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!req || req.agencyId !== agencyId) {
    throw new Error('Request not found or not in your agency')
  }
  if (req.requestedByUserId !== actorUserId) {
    throw new Error('Only the requester can cancel this request')
  }
  if (req.status !== 'OPEN') {
    return
  }

  const { error } = await db
    .from('ContactRequest')
    .update({
      status: 'CANCELLED',
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: actorUserId,
    })
    .eq('id', requestId)
  if (error) throw wrapPostgrestError(error)

  await insertAdminAuditLog({
    actorUserId,
    action: 'CONTACT_REQUEST_CANCELLED',
    targetType: 'CONTACT_REQUEST',
    targetId: requestId,
  })

  revalidatePath('/finance/invoices')
  revalidatePath('/agency/clients')
}
