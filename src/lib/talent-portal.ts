import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { DeliverableRow, InvoiceTripletRow } from '@/types/database'
import { type TalentVatStatus, VAT_THRESHOLD, buildVatStatus, computeVatBand } from '@/lib/vat-monitoring'

export type TalentPortalMilestone = {
  id: string
  dealId: string
  dealNumber: string | null
  dealTitle: string
  clientName: string
  description: string
  invoiceDate: Date
  grossAmount: number
  commissionAmount: number | null
  netPayoutAmount: number | null
  projectedCommissionAmount: number
  projectedNetPayoutAmount: number
  commissionRate: number
  milestoneStatus: string
  payoutStatus: string
  invoicePaidAt: Date | null
  payoutDate: Date | null
  invoiceRef: string | null
  commissionRef: string | null
  deliverables: Array<{
    id: string
    title: string
    dueDate: Date | null
    status: string
  }>
}

export type { TalentVatStatus }

export type TalentPortalData = {
  talent: {
    id: string
    name: string
    email: string
    commissionRate: number
    vatRegistered: boolean
    vatNumber: string | null
    portalEnabled: boolean
  }
  milestones: TalentPortalMilestone[]
  vatStatus: TalentVatStatus | null
  summary: {
    totalDeals: number
    totalMilestones: number
    paymentsReceived: number
    payoutsReady: number
    payoutsPaid: number
    grossReceived: number
    netPaidOut: number
    netPending: number
    projectedGrossToInvoice: number
    projectedCommissionToInvoice: number
    projectedNetToInvoice: number
    lastSyncedAt: Date | null
  }
}

export function formatCurrency(amount: number, currency: string = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount)
}

export async function resolveTalentIdForUser(userId: string | undefined) {
  if (!userId) return null
  const db = getSupabaseServiceRole()
  const { data: user, error } = await db.from('User').select('talentId').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return user?.talentId ?? null
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function getTalentPortalData(talentId: string): Promise<TalentPortalData | null> {
  const db = getSupabaseServiceRole()
  const { data: talent, error: tErr } = await db.from('Talent').select('*').eq('id', talentId).maybeSingle()
  if (tErr) throw new Error(tErr.message)
  if (!talent) return null

  const { data: deals, error: dErr } = await db
    .from('Deal')
    .select('*')
    .eq('talentId', talentId)
    .order('updatedAt', { ascending: false })
  if (dErr) throw new Error(dErr.message)
  if (!deals?.length) {
    const noDealsVatStatus =
      !talent.vatRegistered && !talent.vatNumber
        ? buildVatStatus({ id: talent.id, name: talent.name, email: talent.email }, 0)
        : null
    return {
      talent: {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        commissionRate: Number(talent.commissionRate),
        vatRegistered: talent.vatRegistered,
        vatNumber: talent.vatNumber,
        portalEnabled: talent.portalEnabled,
      },
      milestones: [],
      vatStatus: noDealsVatStatus,
      summary: {
        totalDeals: 0,
        totalMilestones: 0,
        paymentsReceived: 0,
        payoutsReady: 0,
        payoutsPaid: 0,
        grossReceived: 0,
        netPaidOut: 0,
        netPending: 0,
        projectedGrossToInvoice: 0,
        projectedCommissionToInvoice: 0,
        projectedNetToInvoice: 0,
        lastSyncedAt: null,
      },
    }
  }

  const clientIds = [...new Set(deals.map((d) => d.clientId))]
  const dealIds = deals.map((d) => d.id)
  const [{ data: clients }, { data: milestonesRaw }] = await Promise.all([
    db.from('Client').select('id, name').in('id', clientIds),
    db.from('Milestone').select('*').in('dealId', dealIds),
  ])
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]))

  const milestonesSorted = (milestonesRaw ?? []).sort((a, b) => {
    const ad = parseDate(a.invoiceDate)?.getTime() ?? 0
    const bd = parseDate(b.invoiceDate)?.getTime() ?? 0
    return bd - ad
  })

  const milestoneIds = milestonesSorted.map((m) => m.id)
  const [{ data: triplets }, { data: deliverablesRaw }] = await Promise.all([
    milestoneIds.length ? db.from('InvoiceTriplet').select('*').in('milestoneId', milestoneIds) : { data: [] },
    milestoneIds.length ? db.from('Deliverable').select('*').in('milestoneId', milestoneIds) : { data: [] },
  ])

  const tripletByMilestone = new Map((triplets ?? [] as InvoiceTripletRow[]).map((t) => [t.milestoneId, t]))
  const deliverablesByMilestone = new Map<string, DeliverableRow[]>()
  const deliverableRows = (deliverablesRaw ?? []) as DeliverableRow[]
  for (const del of deliverableRows) {
    const list = deliverablesByMilestone.get(del.milestoneId) ?? []
    list.push(del)
    deliverablesByMilestone.set(del.milestoneId, list)
  }
  for (const [, list] of deliverablesByMilestone) {
    if (!list?.length) continue
    list.sort((a, b) => {
      const ac = parseDate(a.createdAt)?.getTime() ?? 0
      const bc = parseDate(b.createdAt)?.getTime() ?? 0
      return ac - bc
    })
  }

  const dealById = new Map(deals.map((d) => [d.id, d]))

  const milestones: TalentPortalMilestone[] = []
  for (const milestone of milestonesSorted) {
    const deal = dealById.get(milestone.dealId)
    if (!deal) continue
    const inv = tripletByMilestone.get(milestone.id) ?? null
    const dels = (deliverablesByMilestone.get(milestone.id) ?? []).map((deliverable) => ({
      id: deliverable.id,
      title: deliverable.title,
      dueDate: parseDate(deliverable.dueDate),
      status: deliverable.status,
    }))
    const gross = Number(milestone.grossAmount)
    const cr = Number(deal.commissionRate)
    milestones.push({
      commissionRate: cr,
      id: milestone.id,
      dealId: deal.id,
      dealNumber: (deal.dealNumber as string | null) ?? null,
      dealTitle: deal.title,
      clientName: clientName.get(deal.clientId) ?? '',
      description: milestone.description,
      invoiceDate: parseDate(milestone.invoiceDate) ?? new Date(0),
      grossAmount: gross,
      commissionAmount: inv ? Number(inv.commissionAmount) : null,
      netPayoutAmount: inv ? Number(inv.netPayoutAmount) : null,
      projectedCommissionAmount: inv ? Number(inv.commissionAmount) : gross * (cr / 100),
      projectedNetPayoutAmount: inv ? Number(inv.netPayoutAmount) : gross * (1 - cr / 100),
      milestoneStatus: milestone.status,
      payoutStatus: milestone.payoutStatus,
      invoicePaidAt: inv ? parseDate(inv.invPaidAt) : null,
      payoutDate: parseDate(milestone.payoutDate),
      invoiceRef: inv?.invNumber ?? inv?.obiNumber ?? null,
      commissionRef: inv?.comNumber ?? null,
      deliverables: dels,
    })
  }

  const uniqueDealIds = new Set(milestones.map((milestone) => milestone.dealId))
  const grossReceived = milestones
    .filter((milestone) => milestone.invoicePaidAt)
    .reduce((sum, milestone) => sum + milestone.grossAmount, 0)
  const netPaidOut = milestones
    .filter((milestone) => milestone.payoutStatus === 'PAID')
    .reduce((sum, milestone) => sum + (milestone.netPayoutAmount ?? 0), 0)
  const netPending = milestones
    .filter((milestone) => milestone.invoicePaidAt && milestone.payoutStatus !== 'PAID')
    .reduce((sum, milestone) => sum + (milestone.netPayoutAmount ?? 0), 0)
  const upcomingMilestones = milestones.filter(
    (milestone) => milestone.milestoneStatus === 'PENDING' || milestone.milestoneStatus === 'COMPLETE',
  )
  const projectedGrossToInvoice = upcomingMilestones.reduce((sum, milestone) => sum + milestone.grossAmount, 0)
  const projectedCommissionToInvoice = upcomingMilestones.reduce(
    (sum, milestone) => sum + milestone.projectedCommissionAmount,
    0,
  )
  const projectedNetToInvoice = upcomingMilestones.reduce(
    (sum, milestone) => sum + milestone.projectedNetPayoutAmount,
    0,
  )
  const lastSyncedAt = milestones.reduce<Date | null>((latest, milestone) => {
    const candidates = [milestone.invoicePaidAt, milestone.payoutDate, milestone.invoiceDate].filter(
      (date): date is Date => !!date,
    )
    if (candidates.length === 0) return latest
    const maxCandidate = new Date(Math.max(...candidates.map((date) => date.getTime())))
    if (!latest || maxCandidate.getTime() > latest.getTime()) {
      return maxCandidate
    }
    return latest
  }, null)

  let vatStatus: TalentVatStatus | null = null
  if (!talent.vatRegistered && !talent.vatNumber) {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const rolling12mTotal = milestones
      .filter((m) => m.invoiceDate >= cutoff && m.netPayoutAmount !== null)
      .reduce((sum, m) => sum + (m.netPayoutAmount ?? 0), 0)
    vatStatus = {
      talentId: talent.id,
      talentName: talent.name,
      talentEmail: talent.email,
      rolling12mTotal,
      band: computeVatBand(rolling12mTotal),
      pctOfThreshold: Math.min(100, Math.round((rolling12mTotal / VAT_THRESHOLD) * 100)),
      remainingToThreshold: Math.max(0, VAT_THRESHOLD - rolling12mTotal),
    }
  }

  return {
    talent: {
      id: talent.id,
      name: talent.name,
      email: talent.email,
      commissionRate: Number(talent.commissionRate),
      vatRegistered: talent.vatRegistered,
      vatNumber: talent.vatNumber,
      portalEnabled: talent.portalEnabled,
    },
    milestones,
    vatStatus,
    summary: {
      totalDeals: uniqueDealIds.size,
      totalMilestones: milestones.length,
      paymentsReceived: milestones.filter((milestone) => !!milestone.invoicePaidAt).length,
      payoutsReady: milestones.filter((milestone) => milestone.payoutStatus === 'READY').length,
      payoutsPaid: milestones.filter((milestone) => milestone.payoutStatus === 'PAID').length,
      grossReceived,
      netPaidOut,
      netPending,
      projectedGrossToInvoice,
      projectedCommissionToInvoice,
      projectedNetToInvoice,
      lastSyncedAt,
    },
  }
}
