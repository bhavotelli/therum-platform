import { loadFinanceInvoiceQueues } from '@/lib/finance/invoice-queue-data'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { SheetColumn } from '@/lib/export/sheet'

export type InvoiceExportRow = {
  invoiceRef: string
  approvalStatus: string
  invoicingModel: string
  invoiceDate: string | null
  dueDate: string | null
  paidAt: string | null
  talentName: string
  clientName: string
  dealNumber: string | null
  dealTitle: string
  milestoneDescription: string
  currency: string
  grossAmount: number
  netPayoutAmount: number
  commissionAmount: number
  poNumber: string | null
  invoiceNarrative: string | null
}

export async function loadInvoiceExportRows(agencyId: string): Promise<InvoiceExportRow[]> {
  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('invoicingModel').eq('id', agencyId).maybeSingle()
  const invoicingModel = (agency?.invoicingModel as string | undefined) ?? 'SELF_BILLING'

  const { pendingTriplets, approvedTriplets } = await loadFinanceInvoiceQueues(agencyId, invoicingModel)
  const all = [...pendingTriplets, ...approvedTriplets] as Record<string, unknown>[]

  return all.map((t) => {
    const milestone = (t.milestone ?? {}) as Record<string, unknown>
    const deal = (milestone.deal ?? {}) as Record<string, unknown>
    const client = (deal.client ?? {}) as Record<string, unknown>
    const talent = (deal.talent ?? {}) as Record<string, unknown>
    const invoiceDateRaw = t.invoiceDate as string | null | undefined
    const dueDays = Number(t.invDueDateDays ?? 0)
    let dueDate: string | null = null
    if (invoiceDateRaw) {
      const d = new Date(invoiceDateRaw)
      d.setDate(d.getDate() + dueDays)
      dueDate = d.toISOString().slice(0, 10)
    }
    return {
      invoiceRef: String(t.invNumber ?? t.obiNumber ?? t.comNumber ?? ''),
      approvalStatus: String(t.approvalStatus ?? ''),
      invoicingModel: String(t.invoicingModel ?? ''),
      invoiceDate: invoiceDateRaw ? new Date(invoiceDateRaw).toISOString().slice(0, 10) : null,
      dueDate,
      paidAt: t.invPaidAt ? new Date(String(t.invPaidAt)).toISOString().slice(0, 10) : null,
      talentName: String(talent.name ?? ''),
      clientName: String(client.name ?? ''),
      dealNumber: (deal.dealNumber as string | null) ?? null,
      dealTitle: String(deal.title ?? ''),
      milestoneDescription: String(milestone.description ?? ''),
      currency: String(deal.currency ?? 'GBP'),
      grossAmount: Number(t.grossAmount ?? 0),
      netPayoutAmount: Number(t.netPayoutAmount ?? 0),
      commissionAmount: Number(t.commissionAmount ?? 0),
      poNumber: (t.poNumber as string | null) ?? null,
      invoiceNarrative: (t.invoiceNarrative as string | null) ?? null,
    }
  })
}

export const invoiceExportColumns: SheetColumn<InvoiceExportRow>[] = [
  { header: 'Invoice Ref', type: 'string', getValue: (r) => r.invoiceRef, width: 16 },
  { header: 'Status', type: 'string', getValue: (r) => r.approvalStatus, width: 12 },
  { header: 'Invoicing Model', type: 'string', getValue: (r) => r.invoicingModel, width: 16 },
  { header: 'Invoice Date', type: 'date', getValue: (r) => r.invoiceDate, width: 14 },
  { header: 'Due Date', type: 'date', getValue: (r) => r.dueDate, width: 14 },
  { header: 'Paid At', type: 'date', getValue: (r) => r.paidAt, width: 14 },
  { header: 'Talent', type: 'string', getValue: (r) => r.talentName, width: 22 },
  { header: 'Client', type: 'string', getValue: (r) => r.clientName, width: 22 },
  { header: 'Deal Number', type: 'string', getValue: (r) => r.dealNumber, width: 14 },
  { header: 'Deal Title', type: 'string', getValue: (r) => r.dealTitle, width: 28 },
  { header: 'Milestone', type: 'string', getValue: (r) => r.milestoneDescription, width: 28 },
  { header: 'Currency', type: 'string', getValue: (r) => r.currency, width: 10 },
  { header: 'Gross', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.grossAmount, width: 14 },
  { header: 'Net Payout', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.netPayoutAmount, width: 14 },
  { header: 'Commission', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.commissionAmount, width: 14 },
  { header: 'PO Number', type: 'string', getValue: (r) => r.poNumber, width: 14 },
  { header: 'Narrative', type: 'string', getValue: (r) => r.invoiceNarrative, width: 32 },
]
