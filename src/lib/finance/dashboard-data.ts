import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function loadFinanceDashboardData(agencyId: string) {
  const db = getSupabaseServiceRole()
  const { data: deals } = await db.from('Deal').select('id').eq('agencyId', agencyId)
  const dealIds = (deals ?? []).map((d) => d.id as string)
  if (dealIds.length === 0) {
    return {
      pendingApprovals: 0,
      pendingExpenses: 0,
      payoutReadyCount: 0,
      payoutReadyRows: [] as Record<string, unknown>[],
      approvedUnpaidTriplets: [] as Record<string, unknown>[],
      recentTriplets: [] as Record<string, unknown>[],
      recentExpenses: [] as Record<string, unknown>[],
      recentChaseNotes: [] as Record<string, unknown>[],
      recentCreditNotes: [] as Record<string, unknown>[],
    }
  }

  const { data: milestones } = await db
    .from('Milestone')
    .select('id, dealId, payoutStatus, grossAmount')
    .in('dealId', dealIds)
  const msList = milestones ?? []
  const mids = msList.map((m) => m.id as string)

  const [
    { count: pendingApprovals },
    { count: pendingExpenses },
    { data: tripsApprovedUnpaid },
    { data: tripsRecent },
    { data: expRows },
    { data: chaseRows },
    { data: cnRows },
  ] = await Promise.all([
    db.from('InvoiceTriplet').select('id', { count: 'exact', head: true }).in('milestoneId', mids).eq('approvalStatus', 'PENDING'),
    db.from('DealExpense').select('id', { count: 'exact', head: true }).eq('agencyId', agencyId).eq('status', 'PENDING'),
    db.from('InvoiceTriplet').select('id').in('milestoneId', mids).eq('approvalStatus', 'PENDING'),
    db.from('InvoiceTriplet').select('*').in('milestoneId', mids).eq('approvalStatus', 'APPROVED').is('invPaidAt', null).limit(200),
    db.from('InvoiceTriplet').select('*').in('milestoneId', mids).order('updatedAt', { ascending: false }).limit(6),
    db
      .from('DealExpense')
      .select('*')
      .eq('agencyId', agencyId)
      .in('status', ['APPROVED', 'EXCLUDED'])
      .order('updatedAt', { ascending: false })
      .limit(6),
    db.from('ChaseNote').select('*').eq('agencyId', agencyId).order('createdAt', { ascending: false }).limit(6),
    db.from('ManualCreditNote').select('*').eq('agencyId', agencyId).order('createdAt', { ascending: false }).limit(6),
  ])

  const payoutMilestones = msList.filter((m) => m.payoutStatus === 'READY')
  const { data: payoutTrips } =
    payoutMilestones.length > 0
      ? await db
          .from('InvoiceTriplet')
          .select('milestoneId, netPayoutAmount')
          .in(
            'milestoneId',
            payoutMilestones.map((m) => m.id as string),
          )
      : { data: [] }

  const tripByMs = Object.fromEntries((payoutTrips ?? []).map((t) => [t.milestoneId, t]))
  const payoutReadyRows = payoutMilestones.map((m) => ({
    id: m.id,
    grossAmount: m.grossAmount,
    invoiceTriplet: tripByMs[m.id as string]
      ? { netPayoutAmount: (tripByMs[m.id as string] as { netPayoutAmount?: string }).netPayoutAmount }
      : null,
  }))

  const aunIds = (tripsApprovedUnpaid ?? []).map((t) => t.id as string)
  let chaseByTriplet = new Map<string, { nextChaseDate: Date | null }[]>()
  if (aunIds.length > 0) {
    const { data: chNotes } = await db
      .from('ChaseNote')
      .select('invoiceTripletId, nextChaseDate, createdAt')
      .in('invoiceTripletId', aunIds)
      .order('createdAt', { ascending: false })
    for (const row of chNotes ?? []) {
      const tid = row.invoiceTripletId as string
      const list = chaseByTriplet.get(tid) ?? []
      const nd = row.nextChaseDate
      list.push({
        nextChaseDate: nd ? new Date(nd as string) : null,
      })
      chaseByTriplet.set(tid, list)
    }
  }

  const approvedUnpaidTriplets = (tripsApprovedUnpaid ?? []).map((t) => ({
    ...t,
    chaseNotes: chaseByTriplet.get(t.id as string) ?? [],
  }))

  const recentTriplets = (tripsRecent ?? []).map((t) => ({
    ...t,
    updatedAt: new Date(t.updatedAt as string),
  }))

  const expWithNames = [] as Record<string, unknown>[]
  const expApproverIds = [...new Set((expRows ?? []).map((e) => e.approvedById).filter(Boolean))] as string[]
  const { data: approvers } =
    expApproverIds.length > 0 ? await db.from('User').select('id, name').in('id', expApproverIds) : { data: [] }
  const apprMap = Object.fromEntries((approvers ?? []).map((u) => [u.id, u.name]))
  for (const e of expRows ?? []) {
    expWithNames.push({
      ...e,
      approvedAt: e.approvedAt ? new Date(e.approvedAt as string) : null,
      updatedAt: new Date(e.updatedAt as string),
      approvedBy: e.approvedById ? { name: apprMap[e.approvedById as string] as string } : null,
    })
  }

  const chaseTripletIds = [...new Set((chaseRows ?? []).map((c) => c.invoiceTripletId).filter(Boolean))] as string[]
  const chaseUserIds = [...new Set((chaseRows ?? []).map((c) => c.createdByUserId).filter(Boolean))] as string[]
  const [{ data: invTripRows }, { data: chaseUsers }] = await Promise.all([
    chaseTripletIds.length ? db.from('InvoiceTriplet').select('id, invNumber, obiNumber').in('id', chaseTripletIds) : Promise.resolve({ data: [] }),
    chaseUserIds.length ? db.from('User').select('id, name').in('id', chaseUserIds) : Promise.resolve({ data: [] }),
  ])
  const invById = Object.fromEntries((invTripRows ?? []).map((r) => [r.id, r]))
  const usrById = Object.fromEntries((chaseUsers ?? []).map((u) => [u.id, u.name]))

  const recentChaseNotes = (chaseRows ?? []).map((n) => ({
    ...n,
    createdAt: new Date(n.createdAt as string),
    invoiceTriplet: invById[n.invoiceTripletId as string] ?? { invNumber: null, obiNumber: null },
    createdByUser: { name: (usrById[n.createdByUserId as string] as string) ?? '' },
  }))

  const cnTripletIds = [...new Set((cnRows ?? []).map((c) => c.invoiceTripletId).filter(Boolean))] as string[]
  let cnTripletMeta = new Map<string, { obiNumber?: string | null; invNumber?: string | null; currency: string }>()
  if (cnTripletIds.length > 0) {
    const { data: cTrips } = await db.from('InvoiceTriplet').select('id, milestoneId, obiNumber, invNumber').in('id', cnTripletIds)
    const cnMids = [...new Set((cTrips ?? []).map((t) => t.milestoneId).filter(Boolean))] as string[]
    const { data: cnMs } = await db.from('Milestone').select('id, dealId').in('id', cnMids)
    const cnDealIds = [...new Set((cnMs ?? []).map((m) => m.dealId).filter(Boolean))] as string[]
    const { data: cnDeals } = await db.from('Deal').select('id, currency').in('id', cnDealIds)
    const dealCur = Object.fromEntries((cnDeals ?? []).map((d) => [d.id, d.currency]))
    const msToDeal = Object.fromEntries((cnMs ?? []).map((m) => [m.id, m.dealId]))
    for (const t of cTrips ?? []) {
      const did = msToDeal[t.milestoneId as string] as string
      cnTripletMeta.set(t.id as string, {
        obiNumber: t.obiNumber as string | null,
        invNumber: t.invNumber as string | null,
        currency: (dealCur[did] as string) || 'GBP',
      })
    }
  }

  const recentCreditNotes = (cnRows ?? []).map((n) => {
    const meta = cnTripletMeta.get(n.invoiceTripletId as string) ?? { currency: 'GBP' }
    return {
      ...n,
      createdAt: new Date(n.createdAt as string),
      invoiceTriplet: {
        obiNumber: meta.obiNumber,
        invNumber: meta.invNumber,
        milestone: { deal: { currency: meta.currency } },
      },
    }
  })

  return {
    pendingApprovals: pendingApprovals ?? 0,
    pendingExpenses: pendingExpenses ?? 0,
    payoutReadyCount: payoutMilestones.length,
    payoutReadyRows,
    approvedUnpaidTriplets,
    recentTriplets,
    recentExpenses: expWithNames,
    recentChaseNotes,
    recentCreditNotes,
  }
}
