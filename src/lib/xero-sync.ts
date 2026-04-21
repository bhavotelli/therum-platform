import { xero } from '@/lib/xero'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { AgencyRow, ClientRow, DealRow, InvoiceTripletRow, MilestoneRow, TalentRow } from '@/types/database'

type TripletWithGraph = InvoiceTripletRow & {
  milestone: MilestoneRow & {
    deal: DealRow & { agency: AgencyRow; client: ClientRow; talent: TalentRow }
  }
}

async function loadTripletFull(tripletId: string): Promise<TripletWithGraph | null> {
  const db = getSupabaseServiceRole()
  const { data: triplet, error: tErr } = await db.from('InvoiceTriplet').select('*').eq('id', tripletId).maybeSingle()
  if (tErr) throw new Error(tErr.message)
  if (!triplet) return null
  const { data: milestone, error: mErr } = await db.from('Milestone').select('*').eq('id', triplet.milestoneId).maybeSingle()
  if (mErr) throw new Error(mErr.message)
  if (!milestone) return null
  const { data: deal, error: dErr } = await db.from('Deal').select('*').eq('id', milestone.dealId).maybeSingle()
  if (dErr) throw new Error(dErr.message)
  if (!deal) return null
  const [{ data: agency }, { data: client }, { data: talent }] = await Promise.all([
    db.from('Agency').select('*').eq('id', deal.agencyId).maybeSingle(),
    db.from('Client').select('*').eq('id', deal.clientId).maybeSingle(),
    db.from('Talent').select('*').eq('id', deal.talentId).maybeSingle(),
  ])
  if (!agency || !client || !talent) return null
  return {
    ...triplet,
    milestone: {
      ...milestone,
      deal: {
        ...deal,
        agency,
        client,
        talent,
      },
    },
  }
}

type XeroInvoiceResult = {
  invoiceID?: string
  invoiceNumber?: string
}

type XeroCreditNoteResult = {
  creditNoteID?: string
  creditNoteNumber?: string
}

type PushResult = {
  xeroInvId?: string | null
  xeroSbiId?: string | null
  xeroComId?: string | null
  xeroObiId?: string | null
  xeroCnId?: string | null
}

function assertAgencyAccessForTriplet(params: {
  expectedAgencyId?: string
  actualAgencyId: string
}) {
  if (params.expectedAgencyId && params.expectedAgencyId !== params.actualAgencyId) {
    throw new Error('Invoice not found or not in your agency')
  }
}

type XeroMappings = {
  inv?: string | null
  sbi?: string | null
  obi?: string | null
  cn?: string | null
  com?: string | null
  expenses?: string | null
}

type XeroClientCompat = {
  setTokenSet: (tokenSet: unknown) => Promise<void> | void
  readTokenSet: () => unknown
  refreshToken: () => Promise<unknown>
  refreshWithRefreshToken: (clientId: string, clientSecret: string, refreshToken: string) => Promise<unknown>
  accountingApi: {
    createInvoices: (tenantId: string, payload: { invoices: Record<string, unknown>[] }) => Promise<unknown>
    createCreditNotes: (tenantId: string, payload: { creditNotes: Record<string, unknown>[] }) => Promise<unknown>
    getInvoice: (tenantId: string, invoiceId: string) => Promise<unknown>
  }
}

const xeroCompat = xero as unknown as XeroClientCompat

function asDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function getXeroMappingsOrThrow(params: {
  invoicingModel: 'SELF_BILLING' | 'ON_BEHALF'
  xeroAccountCodes: unknown
}): Required<Pick<XeroMappings, 'com'>> & Partial<Pick<XeroMappings, 'inv' | 'sbi' | 'obi' | 'cn'>> {
  const raw = params.xeroAccountCodes
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const mappingsRaw = root.mappings
  const mappings = mappingsRaw && typeof mappingsRaw === 'object' ? (mappingsRaw as Record<string, unknown>) : {}
  const normalize = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null)

  const parsed: XeroMappings = {
    inv: normalize(mappings.inv),
    sbi: normalize(mappings.sbi),
    obi: normalize(mappings.obi),
    cn: normalize(mappings.cn),
    com: normalize(mappings.com),
    expenses: normalize(mappings.expenses),
  }

  if (params.invoicingModel === 'SELF_BILLING') {
    if (!parsed.inv || !parsed.sbi || !parsed.com) {
      throw new Error('Missing required Xero account code mappings for SELF_BILLING (INV/SBI/COM).')
    }
    return { inv: parsed.inv, sbi: parsed.sbi, com: parsed.com }
  }

  if (!parsed.obi || !parsed.cn || !parsed.com) {
    throw new Error('Missing required Xero account code mappings for ON_BEHALF (OBI/CN/COM).')
  }
  return { obi: parsed.obi, cn: parsed.cn, com: parsed.com }
}

async function getXeroContext(agencyId: string) {
  const db = getSupabaseServiceRole()
  const { data: agency, error } = await db
    .from('Agency')
    .select('id, xeroTenantId, xeroTokens')
    .eq('id', agencyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!agency) throw new Error('Agency not found for Xero context')
  if (!agency.xeroTenantId) throw new Error('Xero is not connected: missing tenant id')
  if (!agency.xeroTokens) throw new Error('Xero is not connected: missing token set')

  let parsedTokenSet: unknown
  try {
    parsedTokenSet = JSON.parse(agency.xeroTokens)
  } catch {
    throw new Error('Invalid Xero token payload for agency')
  }

  await xeroCompat.setTokenSet(parsedTokenSet)
  return { agencyId: agency.id, tenantId: agency.xeroTenantId }
}

function isXeroUnauthorized(error: unknown): boolean {
  const maybeError = normalizeXeroError(error)

  const statusCode = maybeError?.response?.statusCode
  const detail = maybeError?.response?.body?.Detail
  const message = maybeError?.message

  return (
    statusCode === 401 ||
    (typeof detail === 'string' && detail.includes('TokenExpired')) ||
    (typeof message === 'string' && message.includes('TokenExpired'))
  )
}

function normalizeXeroError(error: unknown): {
  response?: { statusCode?: number; body?: { Detail?: string } }
  message?: string
} {
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error) as {
        response?: { statusCode?: number; body?: { Detail?: string } }
        message?: string
      }
      return {
        ...parsed,
        message: parsed.message ?? error,
      }
    } catch {
      return { message: error }
    }
  }
  return (error ?? {}) as {
    response?: { statusCode?: number; body?: { Detail?: string } }
    message?: string
  }
}

async function refreshAgencyTokenSet(agencyId: string) {
  let refreshed: unknown
  try {
    refreshed = (await xeroCompat.refreshToken()) ?? xeroCompat.readTokenSet()
  } catch {
    const currentTokenSet = xeroCompat.readTokenSet() as { refresh_token?: string } | null
    const refreshToken = currentTokenSet?.refresh_token
    const clientId = process.env.XERO_CLIENT_ID
    const clientSecret = process.env.XERO_CLIENT_SECRET
    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Unable to refresh Xero token set; reconnect Xero in settings.')
    }
    refreshed = await xeroCompat.refreshWithRefreshToken(clientId, clientSecret, refreshToken)
    await xeroCompat.setTokenSet(refreshed)
  }

  const db = getSupabaseServiceRole()
  const { error } = await db.from('Agency').update({ xeroTokens: JSON.stringify(refreshed) }).eq('id', agencyId)
  if (error) throw new Error(error.message)
}

async function withXeroRetry<T>(agencyId: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (error) {
    if (!isXeroUnauthorized(error)) throw error
    await refreshAgencyTokenSet(agencyId)
    return await op()
  }
}

async function createSingleInvoice(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<XeroInvoiceResult | null> {
  const response = (await xeroCompat.accountingApi.createInvoices(tenantId, {
    invoices: [payload],
  })) as {
    body?: {
      invoices?: XeroInvoiceResult[]
    }
  }

  const invoice = response?.body?.invoices?.[0]
  if (!invoice) return null
  return {
    invoiceID: invoice.invoiceID,
    invoiceNumber: invoice.invoiceNumber,
  }
}

async function createSingleCreditNote(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<XeroCreditNoteResult | null> {
  const response = (await xeroCompat.accountingApi.createCreditNotes(tenantId, {
    creditNotes: [payload],
  })) as {
    body?: {
      creditNotes?: XeroCreditNoteResult[]
    }
  }

  const creditNote = response?.body?.creditNotes?.[0]
  if (!creditNote) return null
  return {
    creditNoteID: creditNote.creditNoteID,
    creditNoteNumber: creditNote.creditNoteNumber,
  }
}

export async function pushInvoiceTripletToXero(params: {
  tripletId: string
  expectedAgencyId?: string
}): Promise<PushResult> {
  const { tripletId, expectedAgencyId } = params
  const triplet = await loadTripletFull(tripletId)

  if (!triplet) throw new Error('Invoice triplet not found')

  const { deal } = triplet.milestone
  assertAgencyAccessForTriplet({
    expectedAgencyId,
    actualAgencyId: deal.agencyId,
  })
  const { agencyId, tenantId } = await getXeroContext(deal.agencyId)
  const mappings = getXeroMappingsOrThrow({
    invoicingModel: triplet.invoicingModel,
    xeroAccountCodes: deal.agency.xeroAccountCodes,
  })

  if (!deal.client.xeroContactId) {
    throw new Error('Client is not linked to a Xero contact. Resolve sync before approving this invoice.')
  }
  if (triplet.invoicingModel === 'SELF_BILLING' && !deal.talent.xeroContactId) {
    throw new Error('Talent is not linked to a Xero contact. Resolve sync before approving this self-billing invoice.')
  }

  const invoiceDate = asDate(new Date(triplet.invoiceDate))
  const dueDateObj = new Date(triplet.invoiceDate)
  dueDateObj.setDate(dueDateObj.getDate() + triplet.invDueDateDays)
  const dueDate = asDate(dueDateObj)

  // milestoneRef (e.g. "TH-0001-M02") is stamped onto the Milestone row at creation
  // time by the assign_milestone_ref DB trigger, ordered by the insertion sequence
  // (application inserts milestones sorted by invoiceDate ASC).
  // A null value means the agency had no deal prefix configured when this deal was
  // created — the Xero reference will omit the deal identifier in that case.
  const milestoneRef = triplet.milestone.milestoneRef ?? null
  if (!milestoneRef) {
    console.warn(
      `[xero-sync] No milestoneRef on milestone ${triplet.milestone.id} ` +
        `(deal ${deal.id}, dealNumber: ${deal.dealNumber ?? 'none'}) — ` +
        `Xero reference will omit the deal identifier. ` +
        `Set an agency deal prefix to enable end-to-end deal traceability in Xero.`,
    )
  }

  const referenceParts = [
    milestoneRef,
    triplet.poNumber ? `PO: ${triplet.poNumber}` : null,
    triplet.recipientContactName ? `ATTN: ${triplet.recipientContactName}` : null,
  ].filter(Boolean)
  const narrativeSuffix = triplet.invoiceNarrative ? ` · ${triplet.invoiceNarrative}` : ''

  const payloadCommon = {
    date: invoiceDate,
    dueDate,
    status: 'AUTHORISED',
    lineAmountTypes: 'Exclusive',
    reference: referenceParts.length > 0 ? referenceParts.join(' | ') : undefined,
    lineItems: [
      {
        description: `${triplet.milestone.description}${narrativeSuffix}`,
        quantity: 1,
        unitAmount: Number(triplet.grossAmount),
        accountCode: mappings.com,
      },
    ],
  }

  const result: PushResult = {
    xeroInvId: null,
    xeroSbiId: null,
    xeroComId: null,
    xeroObiId: null,
    xeroCnId: null,
  }

  // Reference numbers are assigned by Xero (not pre-set by Therum).
  // We omit invoiceNumber/creditNoteNumber from payloads so Xero auto-sequences,
  // then mirror the assigned numbers back into InvoiceTriplet after the push.
  type AssignedRefs = {
    invNumber: string | null
    sbiNumber: string | null
    obiNumber: string | null
    cnNumber: string | null
    comNumber: string | null
  }
  const assignedRefs: AssignedRefs = {
    invNumber: null,
    sbiNumber: null,
    obiNumber: null,
    cnNumber: null,
    comNumber: null,
  }

  // All Xero API calls for a triplet are wrapped in a single try-catch.
  // If any document in the batch fails, no DB updates are made — the triplet
  // stays PENDING and can be retried. Note: any documents already created in
  // Xero before the failure will need to be voided manually if retrying.
  try {
    if (triplet.invoicingModel === 'SELF_BILLING') {
      const invInvoice = await withXeroRetry(agencyId, () =>
        createSingleInvoice(tenantId, {
          ...payloadCommon,
          type: 'ACCREC',
          contact: { contactID: deal.client.xeroContactId },
          lineItems: [
            {
              description: `${triplet.milestone.description} (INV)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.grossAmount),
              accountCode: mappings.inv,
            },
          ],
        })
      )
      // Assign IDs immediately so the catch block can detect partial failures.
      result.xeroInvId = invInvoice?.invoiceID ?? null
      assignedRefs.invNumber = invInvoice?.invoiceNumber ?? null

      const sbiInvoice = await withXeroRetry(agencyId, () =>
        createSingleInvoice(tenantId, {
          ...payloadCommon,
          type: 'ACCPAY',
          contact: { contactID: deal.talent.xeroContactId },
          lineItems: [
            {
              description: `${triplet.milestone.description} (SBI)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.netPayoutAmount),
              accountCode: mappings.sbi,
            },
          ],
        })
      )
      result.xeroSbiId = sbiInvoice?.invoiceID ?? null
      assignedRefs.sbiNumber = sbiInvoice?.invoiceNumber ?? null

      const comInvoice = await withXeroRetry(agencyId, () =>
        createSingleInvoice(tenantId, {
          ...payloadCommon,
          type: 'ACCREC',
          contact: { contactID: deal.client.xeroContactId },
          lineItems: [
            {
              description: `${triplet.milestone.description} (COM)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.commissionAmount),
              accountCode: mappings.com,
            },
          ],
        })
      )
      result.xeroComId = comInvoice?.invoiceID ?? null
      assignedRefs.comNumber = comInvoice?.invoiceNumber ?? null
    } else {
      const obiInvoice = await withXeroRetry(agencyId, () =>
        createSingleInvoice(tenantId, {
          ...payloadCommon,
          type: 'ACCREC',
          contact: { contactID: deal.client.xeroContactId },
          lineItems: [
            {
              description: `${triplet.milestone.description} (OBI)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.grossAmount),
              accountCode: mappings.obi,
            },
          ],
        })
      )
      // Assign ID immediately so the catch block can detect partial failures.
      result.xeroObiId = obiInvoice?.invoiceID ?? null

      // Guard: Xero must return an invoice number for the OBI before we can create
      // the settlement CN — the CN's reference field links it back to the OBI for audit.
      if (!obiInvoice?.invoiceNumber) {
        throw new Error(
          `[Agency ${agencyId}] Xero did not return an invoice number for OBI on triplet ${triplet.id} — cannot proceed with CN creation.`
        )
      }
      assignedRefs.obiNumber = obiInvoice.invoiceNumber

      // Settlement CN: nets off the OBI gross on P&L. Reference is set to the
      // Xero-assigned OBI invoice number for cross-referencing in Xero.
      const settlementCn = await withXeroRetry(agencyId, () =>
        createSingleCreditNote(tenantId, {
          type: 'ACCRECCREDIT',
          contact: { contactID: deal.client.xeroContactId },
          date: invoiceDate,
          status: 'AUTHORISED',
          lineAmountTypes: 'Exclusive',
          lineItems: [
            {
              description: `${triplet.milestone.description} (CN)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.grossAmount),
              accountCode: mappings.cn,
            },
          ],
          reference: obiInvoice.invoiceNumber,
        }),
      )
      result.xeroCnId = settlementCn?.creditNoteID ?? null
      assignedRefs.cnNumber = settlementCn?.creditNoteNumber ?? null

      const comInvoice = await withXeroRetry(agencyId, () =>
        createSingleInvoice(tenantId, {
          ...payloadCommon,
          type: 'ACCREC',
          contact: { contactID: deal.client.xeroContactId },
          lineItems: [
            {
              description: `${triplet.milestone.description} (COM)${narrativeSuffix}`,
              quantity: 1,
              unitAmount: Number(triplet.commissionAmount),
              accountCode: mappings.com,
            },
          ],
        })
      )
      result.xeroComId = comInvoice?.invoiceID ?? null
      assignedRefs.comNumber = comInvoice?.invoiceNumber ?? null
    }
  } catch (error) {
    // Detect partial failure: if any Xero IDs were assigned before the failure,
    // documents exist in Xero that need manual cleanup before the triplet can be retried.
    const hasPartialXeroData = Object.values(result).some((v) => v !== null)

    if (hasPartialXeroData) {
      console.error(
        `[Agency ${agencyId}] Partial Xero push detected for triplet ${triplet.id} — ` +
          `setting xeroCleanupRequired. Partial IDs: ${JSON.stringify(result)}`,
      )
      // Best-effort: flag the triplet so Finance Portal surfaces a warning.
      // We do not throw on failure here — the outer throw is more important.
      const cleanupDb = getSupabaseServiceRole()
      await cleanupDb
        .from('InvoiceTriplet')
        .update({ xeroCleanupRequired: true })
        .eq('id', triplet.id)
        .then(({ error: flagErr }) => {
          if (flagErr) {
            console.error(
              `[Agency ${agencyId}] Failed to set xeroCleanupRequired on triplet ${triplet.id}: ${flagErr.message}`,
            )
          }
        })
    }

    throw new Error(
      `[Agency ${agencyId}] Xero push failed mid-batch for triplet ${triplet.id}` +
        (hasPartialXeroData
          ? ' — CLEANUP REQUIRED: void partially created Xero documents before retrying'
          : ' — no documents were created in Xero, safe to retry') +
        `. Cause: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const dbUp = getSupabaseServiceRole()
  const { error: upT } = await dbUp
    .from('InvoiceTriplet')
    .update({
      xeroInvId: result.xeroInvId ?? null,
      xeroSbiId: result.xeroSbiId ?? null,
      xeroComId: result.xeroComId ?? null,
      xeroObiId: result.xeroObiId ?? null,
      xeroCnId: result.xeroCnId ?? null,
      ...assignedRefs,
    })
    .eq('id', triplet.id)
  if (upT) throw new Error(`[Agency ${agencyId}] Failed to update InvoiceTriplet ${triplet.id} with Xero reference numbers: ${upT.message}`)

  const { error: upM } = await dbUp.from('Milestone').update({ status: 'INVOICED' }).eq('id', triplet.milestoneId)
  if (upM) throw upM

  return result
}

export async function pushObiCreditNoteToXero(params: {
  tripletId: string
  amount: number
  reason: string
  creditDate: Date
  cnNumber?: string | null
  expectedAgencyId?: string
}): Promise<{ xeroCnId: string | null; xeroCnNumber: string | null }> {
  const { tripletId, amount, reason, creditDate, cnNumber, expectedAgencyId } = params
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Credit note amount must be greater than zero')
  }

  const triplet = await loadTripletFull(tripletId)

  if (!triplet) throw new Error('Invoice triplet not found for credit note push')
  if (triplet.invoicingModel !== 'ON_BEHALF') {
    throw new Error('Credit note push is only supported for OBI triplets')
  }
  const { deal } = triplet.milestone
  assertAgencyAccessForTriplet({
    expectedAgencyId,
    actualAgencyId: deal.agencyId,
  })
  if (!triplet.xeroObiId) {
    throw new Error('OBI invoice has not been pushed to Xero yet')
  }
  if (!deal.client.xeroContactId) {
    throw new Error('Client is not linked to a Xero contact. Resolve sync before raising OBI CN.')
  }
  const mappings = getXeroMappingsOrThrow({
    invoicingModel: 'ON_BEHALF',
    xeroAccountCodes: deal.agency.xeroAccountCodes,
  })

  const { agencyId, tenantId } = await getXeroContext(deal.agencyId)
  const normalizedReason = reason.trim().slice(0, 200) || 'OBI amendment'

  const creditNote = await withXeroRetry(agencyId, () =>
    createSingleCreditNote(tenantId, {
      type: 'ACCRECCREDIT',
      contact: {
        contactID: deal.client.xeroContactId,
      },
      date: asDate(creditDate),
      status: 'AUTHORISED',
      creditNoteNumber: cnNumber ?? triplet.cnNumber ?? undefined,
      lineAmountTypes: 'Exclusive',
      lineItems: [
        {
          description: `${triplet.milestone.description} (CN) · ${normalizedReason}`,
          quantity: 1,
          unitAmount: amount,
          accountCode: mappings.cn,
        },
      ],
      reference: triplet.obiNumber ?? undefined,
    })
  )

  return {
    xeroCnId: creditNote?.creditNoteID ?? null,
    xeroCnNumber: creditNote?.creditNoteNumber ?? null,
  }
}

export async function pushSelfBillingCreditNotesToXero(params: {
  tripletId: string
  reason: string
  creditDate: Date
  cnNumber?: string | null
  expectedAgencyId?: string
}): Promise<{
  xeroInvCnId: string | null
  xeroInvCnNumber: string | null
  xeroSbiCnId: string | null
  xeroSbiCnNumber: string | null
  xeroComCnId: string | null
  xeroComCnNumber: string | null
}> {
  const { tripletId, reason, creditDate, cnNumber, expectedAgencyId } = params
  const normalizedReason = reason.trim().slice(0, 200) || 'SBI re-raise adjustment'

  const triplet = await loadTripletFull(tripletId)

  if (!triplet) throw new Error('Invoice triplet not found for self-billing credit note push')
  if (triplet.invoicingModel !== 'SELF_BILLING') {
    throw new Error('Self-billing credit note push is only supported for SELF_BILLING triplets')
  }

  const { deal } = triplet.milestone
  assertAgencyAccessForTriplet({
    expectedAgencyId,
    actualAgencyId: deal.agencyId,
  })
  const { agencyId, tenantId } = await getXeroContext(deal.agencyId)
  const mappings = getXeroMappingsOrThrow({
    invoicingModel: 'SELF_BILLING',
    xeroAccountCodes: deal.agency.xeroAccountCodes,
  })
  if (!deal.client.xeroContactId) {
    throw new Error('Client is not linked to a Xero contact. Resolve sync before raising self-billing CN.')
  }
  if (!deal.talent.xeroContactId) {
    throw new Error('Talent is not linked to a Xero contact. Resolve sync before raising self-billing CN.')
  }

  const invCn = triplet.xeroInvId
    ? await withXeroRetry(agencyId, () =>
        createSingleCreditNote(tenantId, {
          type: 'ACCRECCREDIT',
          contact: { contactID: deal.client.xeroContactId },
          date: asDate(creditDate),
          status: 'AUTHORISED',
          creditNoteNumber: cnNumber ?? undefined,
          lineAmountTypes: 'Exclusive',
          lineItems: [
            {
              description: `${triplet.milestone.description} (INV CN) · ${normalizedReason}`,
              quantity: 1,
              unitAmount: Number(triplet.grossAmount),
              accountCode: mappings.inv,
            },
          ],
          reference: triplet.invNumber ?? triplet.comNumber ?? undefined,
        })
      )
    : null

  const sbiCn = triplet.xeroSbiId
    ? await withXeroRetry(agencyId, () =>
        createSingleCreditNote(tenantId, {
          type: 'ACCPAYCREDIT',
          contact: { contactID: deal.talent.xeroContactId },
          date: asDate(creditDate),
          status: 'AUTHORISED',
          creditNoteNumber: cnNumber ? `${cnNumber}-SBI` : undefined,
          lineAmountTypes: 'Exclusive',
          lineItems: [
            {
              description: `${triplet.milestone.description} (SBI CN) · ${normalizedReason}`,
              quantity: 1,
              unitAmount: Number(triplet.netPayoutAmount),
              accountCode: mappings.sbi,
            },
          ],
          reference: triplet.sbiNumber ?? undefined,
        })
      )
    : null

  const comCn = triplet.xeroComId
    ? await withXeroRetry(agencyId, () =>
        createSingleCreditNote(tenantId, {
          type: 'ACCRECCREDIT',
          contact: { contactID: deal.client.xeroContactId },
          date: asDate(creditDate),
          status: 'AUTHORISED',
          creditNoteNumber: cnNumber ? `${cnNumber}-COM` : undefined,
          lineAmountTypes: 'Exclusive',
          lineItems: [
            {
              description: `${triplet.milestone.description} (COM CN) · ${normalizedReason}`,
              quantity: 1,
              unitAmount: Number(triplet.commissionAmount),
              accountCode: mappings.com,
            },
          ],
          reference: triplet.comNumber ?? undefined,
        })
      )
    : null

  return {
    xeroInvCnId: invCn?.creditNoteID ?? null,
    xeroInvCnNumber: invCn?.creditNoteNumber ?? null,
    xeroSbiCnId: sbiCn?.creditNoteID ?? null,
    xeroSbiCnNumber: sbiCn?.creditNoteNumber ?? null,
    xeroComCnId: comCn?.creditNoteID ?? null,
    xeroComCnNumber: comCn?.creditNoteNumber ?? null,
  }
}

export async function syncInvoiceFromXeroEvent(params: {
  tenantId: string
  resourceId: string
}): Promise<{ talentId: string | null }> {
  const { tenantId, resourceId } = params

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id, xeroTokens').eq('xeroTenantId', tenantId).maybeSingle()

  if (!agency?.xeroTokens) return { talentId: null }

  await xeroCompat.setTokenSet(JSON.parse(agency.xeroTokens))
  const response = (await withXeroRetry(agency.id, async () =>
    xeroCompat.accountingApi.getInvoice(tenantId, resourceId)
  )) as {
    body?: {
      invoices?: Array<{
        invoiceID?: string
        status?: string
        amountDue?: number | string
        amountPaid?: number | string
      }>
    }
  }
  const invoice = response?.body?.invoices?.[0]
  if (!invoice) return { talentId: null }

  const invoiceId = invoice.invoiceID as string | undefined
  if (!invoiceId) return { talentId: null }

  const isPaid =
    invoice.status === 'PAID' ||
    (Number(invoice.amountDue ?? 1) === 0 && Number(invoice.amountPaid ?? 0) > 0)

  if (!isPaid) return { talentId: null }

  const { data: candidates } = await db
    .from('InvoiceTriplet')
    .select('id')
    .or(`xeroInvId.eq.${invoiceId},xeroObiId.eq.${invoiceId}`)

  let fullTriplet: TripletWithGraph | null = null
  for (const c of candidates ?? []) {
    const full = await loadTripletFull(c.id)
    if (full && full.milestone.deal.agencyId === agency.id) {
      fullTriplet = full
      break
    }
  }

  if (!fullTriplet) return { talentId: null }

  const { error: u1 } = await db
    .from('InvoiceTriplet')
    .update({ invPaidAt: new Date().toISOString() })
    .eq('id', fullTriplet.id)
  if (u1) throw u1
  const { error: u2 } = await db
    .from('Milestone')
    .update({ status: 'PAID', payoutStatus: 'READY' })
    .eq('id', fullTriplet.milestoneId)
  if (u2) throw u2

  return { talentId: fullTriplet.milestone.deal.talentId }
}
