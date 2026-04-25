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
  grossAmount: number | null
  invoiceRef: string | null
  approvalStatus: string | null
  netPayoutAmount: number | null
  commissionAmount: number | null
  paidAt: string | null
}

type FinanceDealForExport = {
  dealNumber: string | null
  title: string | null
  stage: string | null
  currency: string | null
  client: { name: string | null }
  talent: { name: string | null }
  milestones: FinanceDealMilestone[]
}

type FinanceDealMilestone = {
  description: string | null
  status: string | null
  payoutStatus: string | null
  invoiceDate: string | null
  deliveryDueDate: string | null
  grossAmount: string | number | null
  invoiceTriplet: FinanceDealTriplet | null
}

type FinanceDealTriplet = {
  invNumber: string | null
  obiNumber: string | null
  comNumber: string | null
  approvalStatus: string | null
  netPayoutAmount: string | number | null
  commissionAmount: string | number | null
  invPaidAt: string | null
}

const NO_MILESTONES_LABEL = '(No milestones)'

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export async function loadDealExportRows(agencyId: string): Promise<DealMilestoneExportRow[]> {
  const deals = (await loadFinanceDealsForAgency(agencyId)) as unknown as FinanceDealForExport[]
  const rows: DealMilestoneExportRow[] = []
  for (const deal of deals) {
    const dealHeader = {
      dealNumber: deal.dealNumber ?? null,
      dealTitle: deal.title ?? '',
      stage: deal.stage ?? '',
      clientName: deal.client?.name ?? '',
      talentName: deal.talent?.name ?? '',
      currency: deal.currency ?? 'GBP',
    }
    const milestones = deal.milestones ?? []
    if (milestones.length === 0) {
      rows.push({
        ...dealHeader,
        milestoneDescription: NO_MILESTONES_LABEL,
        milestoneStatus: '',
        payoutStatus: '',
        invoiceDate: null,
        deliveryDueDate: null,
        grossAmount: null,
        invoiceRef: null,
        approvalStatus: null,
        netPayoutAmount: null,
        commissionAmount: null,
        paidAt: null,
      })
      continue
    }
    for (const m of milestones) {
      const triplet = m.invoiceTriplet
      rows.push({
        ...dealHeader,
        milestoneDescription: m.description ?? '',
        milestoneStatus: m.status ?? '',
        payoutStatus: m.payoutStatus ?? '',
        invoiceDate: isoOrNull(m.invoiceDate),
        deliveryDueDate: isoOrNull(m.deliveryDueDate),
        grossAmount: m.grossAmount === null || m.grossAmount === undefined ? null : Number(m.grossAmount),
        invoiceRef: triplet ? (triplet.invNumber ?? triplet.obiNumber ?? triplet.comNumber ?? null) : null,
        approvalStatus: triplet ? triplet.approvalStatus ?? '' : null,
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
