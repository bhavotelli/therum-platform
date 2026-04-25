import { loadFinanceDealsForAgency } from '@/lib/finance/deals-page-data'
import type { SheetColumn } from '@/lib/export/sheet'

export type DealMilestoneExportRow = {
  dealNumber: string | null
  dealTitle: string
  stage: string
  clientName: string
  talentName: string
  currency: string
  milestoneDescription: string
  milestoneStatus: string
  payoutStatus: string
  invoiceDate: string | null
  deliveryDueDate: string | null
  grossAmount: number
  invoiceRef: string | null
  approvalStatus: string | null
  netPayoutAmount: number | null
  commissionAmount: number | null
  paidAt: string | null
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export async function loadDealExportRows(agencyId: string): Promise<DealMilestoneExportRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (await loadFinanceDealsForAgency(agencyId)) as any[]
  const rows: DealMilestoneExportRow[] = []
  for (const deal of deals) {
    const milestones = (deal.milestones ?? []) as Record<string, unknown>[]
    if (milestones.length === 0) {
      rows.push({
        dealNumber: (deal.dealNumber as string | null) ?? null,
        dealTitle: String(deal.title ?? ''),
        stage: String(deal.stage ?? ''),
        clientName: String(deal.client?.name ?? ''),
        talentName: String(deal.talent?.name ?? ''),
        currency: String(deal.currency ?? 'GBP'),
        milestoneDescription: '',
        milestoneStatus: '',
        payoutStatus: '',
        invoiceDate: null,
        deliveryDueDate: null,
        grossAmount: 0,
        invoiceRef: null,
        approvalStatus: null,
        netPayoutAmount: null,
        commissionAmount: null,
        paidAt: null,
      })
      continue
    }
    for (const m of milestones) {
      const triplet = m.invoiceTriplet as Record<string, unknown> | null
      rows.push({
        dealNumber: (deal.dealNumber as string | null) ?? null,
        dealTitle: String(deal.title ?? ''),
        stage: String(deal.stage ?? ''),
        clientName: String(deal.client?.name ?? ''),
        talentName: String(deal.talent?.name ?? ''),
        currency: String(deal.currency ?? 'GBP'),
        milestoneDescription: String(m.description ?? ''),
        milestoneStatus: String(m.status ?? ''),
        payoutStatus: String(m.payoutStatus ?? ''),
        invoiceDate: isoOrNull(m.invoiceDate),
        deliveryDueDate: isoOrNull(m.deliveryDueDate),
        grossAmount: Number(m.grossAmount ?? 0),
        invoiceRef: triplet
          ? String(triplet.invNumber ?? triplet.obiNumber ?? triplet.comNumber ?? '')
          : null,
        approvalStatus: triplet ? String(triplet.approvalStatus ?? '') : null,
        netPayoutAmount: triplet ? Number(triplet.netPayoutAmount ?? 0) : null,
        commissionAmount: triplet ? Number(triplet.commissionAmount ?? 0) : null,
        paidAt: triplet ? isoOrNull(triplet.invPaidAt) : null,
      })
    }
  }
  return rows
}

export const dealExportColumns: SheetColumn<DealMilestoneExportRow>[] = [
  { header: 'Deal Number', type: 'string', getValue: (r) => r.dealNumber, width: 14 },
  { header: 'Deal Title', type: 'string', getValue: (r) => r.dealTitle, width: 28 },
  { header: 'Stage', type: 'string', getValue: (r) => r.stage, width: 14 },
  { header: 'Client', type: 'string', getValue: (r) => r.clientName, width: 22 },
  { header: 'Talent', type: 'string', getValue: (r) => r.talentName, width: 22 },
  { header: 'Currency', type: 'string', getValue: (r) => r.currency, width: 10 },
  { header: 'Milestone', type: 'string', getValue: (r) => r.milestoneDescription, width: 28 },
  { header: 'Milestone Status', type: 'string', getValue: (r) => r.milestoneStatus, width: 16 },
  { header: 'Payout Status', type: 'string', getValue: (r) => r.payoutStatus, width: 16 },
  { header: 'Invoice Date', type: 'date', getValue: (r) => r.invoiceDate, width: 14 },
  { header: 'Delivery Due', type: 'date', getValue: (r) => r.deliveryDueDate, width: 14 },
  { header: 'Gross', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.grossAmount, width: 14 },
  { header: 'Invoice Ref', type: 'string', getValue: (r) => r.invoiceRef, width: 16 },
  { header: 'Approval Status', type: 'string', getValue: (r) => r.approvalStatus, width: 14 },
  { header: 'Net Payout', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.netPayoutAmount, width: 14 },
  { header: 'Commission', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.commissionAmount, width: 14 },
  { header: 'Paid At', type: 'date', getValue: (r) => r.paidAt, width: 14 },
]
