import prisma from '@/lib/prisma'
import { xero } from '@/lib/xero'

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
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      xeroTenantId: true,
      xeroTokens: true,
    },
  })

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

  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      xeroTokens: JSON.stringify(refreshed),
    },
  })
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

export async function pushInvoiceTripletToXero(tripletId: string): Promise<PushResult> {
  const triplet = await prisma.invoiceTriplet.findUnique({
    where: { id: tripletId },
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
    },
  })

  if (!triplet) throw new Error('Invoice triplet not found')

  const { deal } = triplet.milestone
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

  const referenceParts = [
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

  if (triplet.invoicingModel === 'SELF_BILLING') {
    const invInvoice = await withXeroRetry(agencyId, () =>
      createSingleInvoice(tenantId, {
      ...payloadCommon,
      type: 'ACCREC',
      invoiceNumber: triplet.invNumber ?? undefined,
      contact: {
        contactID: deal.client.xeroContactId,
      },
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

    const sbiInvoice = await withXeroRetry(agencyId, () =>
      createSingleInvoice(tenantId, {
      ...payloadCommon,
      type: 'ACCPAY',
      invoiceNumber: triplet.sbiNumber ?? undefined,
      contact: {
        contactID: deal.talent.xeroContactId,
      },
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

    const comInvoice = await withXeroRetry(agencyId, () =>
      createSingleInvoice(tenantId, {
      ...payloadCommon,
      type: 'ACCREC',
      invoiceNumber: triplet.comNumber ?? undefined,
      contact: {
        contactID: deal.client.xeroContactId,
      },
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

    result.xeroInvId = invInvoice?.invoiceID ?? null
    result.xeroSbiId = sbiInvoice?.invoiceID ?? null
    result.xeroComId = comInvoice?.invoiceID ?? null
  } else {
    const obiInvoice = await withXeroRetry(agencyId, () =>
      createSingleInvoice(tenantId, {
      ...payloadCommon,
      type: 'ACCREC',
      invoiceNumber: triplet.obiNumber ?? undefined,
      contact: {
        contactID: deal.client.xeroContactId,
      },
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

    const comInvoice = await withXeroRetry(agencyId, () =>
      createSingleInvoice(tenantId, {
      ...payloadCommon,
      type: 'ACCREC',
      invoiceNumber: triplet.comNumber ?? undefined,
      contact: {
        contactID: deal.client.xeroContactId,
      },
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

    // Keep CN as a deferred explicit flow for now; placeholder to avoid fake documents.
    result.xeroObiId = obiInvoice?.invoiceID ?? null
    result.xeroComId = comInvoice?.invoiceID ?? null
    result.xeroCnId = null
  }

  await prisma.invoiceTriplet.update({
    where: { id: triplet.id },
    data: {
      xeroInvId: result.xeroInvId ?? undefined,
      xeroSbiId: result.xeroSbiId ?? undefined,
      xeroComId: result.xeroComId ?? undefined,
      xeroObiId: result.xeroObiId ?? undefined,
      xeroCnId: result.xeroCnId ?? undefined,
    },
  })

  await prisma.milestone.update({
    where: { id: triplet.milestoneId },
    data: {
      status: 'INVOICED',
    },
  })

  return result
}

export async function pushObiCreditNoteToXero(params: {
  tripletId: string
  amount: number
  reason: string
  creditDate: Date
  cnNumber?: string | null
}): Promise<{ xeroCnId: string | null; xeroCnNumber: string | null }> {
  const { tripletId, amount, reason, creditDate, cnNumber } = params
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Credit note amount must be greater than zero')
  }

  const triplet = await prisma.invoiceTriplet.findUnique({
    where: { id: tripletId },
    include: {
      milestone: {
        include: {
          deal: {
            include: {
              agency: true,
              client: true,
            },
          },
        },
      },
    },
  })

  if (!triplet) throw new Error('Invoice triplet not found for credit note push')
  if (triplet.invoicingModel !== 'ON_BEHALF') {
    throw new Error('Credit note push is only supported for OBI triplets')
  }
  const { deal } = triplet.milestone
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
}): Promise<{
  xeroInvCnId: string | null
  xeroInvCnNumber: string | null
  xeroSbiCnId: string | null
  xeroSbiCnNumber: string | null
  xeroComCnId: string | null
  xeroComCnNumber: string | null
}> {
  const { tripletId, reason, creditDate, cnNumber } = params
  const normalizedReason = reason.trim().slice(0, 200) || 'SBI re-raise adjustment'

  const triplet = await prisma.invoiceTriplet.findUnique({
    where: { id: tripletId },
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
    },
  })

  if (!triplet) throw new Error('Invoice triplet not found for self-billing credit note push')
  if (triplet.invoicingModel !== 'SELF_BILLING') {
    throw new Error('Self-billing credit note push is only supported for SELF_BILLING triplets')
  }

  const { deal } = triplet.milestone
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

  const agency = await prisma.agency.findFirst({
    where: { xeroTenantId: tenantId },
    select: { id: true, xeroTokens: true },
  })

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

  const triplet = await prisma.invoiceTriplet.findFirst({
    where: {
      OR: [
        { xeroInvId: invoiceId },
        { xeroObiId: invoiceId },
      ],
    },
    select: {
      id: true,
      milestoneId: true,
      milestone: {
        select: {
          deal: {
            select: {
              talentId: true,
            },
          },
        },
      },
    },
  })

  if (!triplet) return { talentId: null }

  await prisma.$transaction([
    prisma.invoiceTriplet.update({
      where: { id: triplet.id },
      data: {
        invPaidAt: new Date(),
      },
    }),
    prisma.milestone.update({
      where: { id: triplet.milestoneId },
      data: {
        status: 'PAID',
        payoutStatus: 'READY',
      },
    }),
  ])

  return { talentId: triplet.milestone.deal.talentId }
}
