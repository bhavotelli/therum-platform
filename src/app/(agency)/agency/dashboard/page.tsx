import { notFound, redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type {
  ClientRow,
  DealRow,
  DeliverableRow,
  InvoiceTripletRow,
  MilestoneRow,
  TalentRow,
} from '@/types/database'

const STAGE_LABEL: Record<string, string> = {
  PIPELINE: 'Prospect',
  NEGOTIATING: 'Negotiating',
  CONTRACTED: 'Contracting',
  ACTIVE: 'Active',
  IN_BILLING: 'In Billing',
  COMPLETED: 'Completed',
}

function parseTs(s: string): Date {
  return new Date(s)
}

export default async function AgencyDashboardPage() {
  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') redirect('/login')
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') notFound()
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">No agency linked to this user yet.</div>
    )
  }

  const agencyId = agencyCtx.agencyId
  const db = getSupabaseServiceRole()

  const { data: agency, error: aErr } = await db.from('Agency').select('name').eq('id', agencyId).maybeSingle()
  if (aErr) throw aErr

  const { data: dealsRaw, error: dErr } = await db
    .from('Deal')
    .select('id, title, stage, probability, commissionRate, createdAt, clientId, talentId')
    .eq('agencyId', agencyId)
    .order('createdAt', { ascending: false })
  if (dErr) throw dErr
  const dealsList = (dealsRaw ?? []) as DealRow[]
  const dealIds = dealsList.map((d) => d.id)

  const { data: milestonesForDeals, error: mErr } = dealIds.length
    ? await db.from('Milestone').select('id, dealId, grossAmount, status').in('dealId', dealIds)
    : { data: [], error: null }
  if (mErr) throw mErr

  const milestoneIds = (milestonesForDeals ?? []).map((m) => m.id)

  const [
    { data: clientRows },
    { data: talentRows },
    { data: allTriplets },
    { data: allDeliverables },
  ] = await Promise.all([
    dealsList.length
      ? db
          .from('Client')
          .select('id, name')
          .in('id', [...new Set(dealsList.map((d) => d.clientId))])
      : { data: [] },
    dealsList.length
      ? db
          .from('Talent')
          .select('id, name')
          .in('id', [...new Set(dealsList.map((d) => d.talentId))])
      : { data: [] },
    milestoneIds.length ? db.from('InvoiceTriplet').select('*').in('milestoneId', milestoneIds) : { data: [] },
    milestoneIds.length
      ? db.from('Deliverable').select('id, status, milestoneId').in('milestoneId', milestoneIds)
      : { data: [] },
  ])

  const milestonesByDeal = new Map<string, Array<{ grossAmount: string }>>()
  const milestoneStatusById = new Map<string, string>()
  for (const m of (milestonesForDeals ?? []) as MilestoneRow[]) {
    const list = milestonesByDeal.get(m.dealId) ?? []
    list.push({ grossAmount: m.grossAmount })
    milestonesByDeal.set(m.dealId, list)
    milestoneStatusById.set(m.id, m.status)
  }

  const clientMap = new Map((clientRows ?? [] as ClientRow[]).map((c) => [c.id, c.name]))
  const talentMap = new Map((talentRows ?? [] as TalentRow[]).map((t) => [t.id, t.name]))

  const triplets = (allTriplets ?? []) as InvoiceTripletRow[]
  const milestoneIdsForAgency = new Set(((milestonesForDeals ?? []) as MilestoneRow[]).map((m) => m.id))
  const pendingTriplets = triplets.filter(
    (t) => t.approvalStatus === 'PENDING' && milestoneIdsForAgency.has(t.milestoneId),
  ).length

  const deliverables = (allDeliverables ?? []) as DeliverableRow[]
  const pendingDeliverables = deliverables.filter((d) => d.status !== 'APPROVED').length

  const totalBilledSum = triplets
    .filter((t) => milestoneIdsForAgency.has(t.milestoneId))
    .reduce((s, t) => s + Number(t.grossAmount), 0)
  const totalPaidSum = triplets
    .filter((t) => milestoneIdsForAgency.has(t.milestoneId) && milestoneStatusById.get(t.milestoneId) === 'PAID')
    .reduce((s, t) => s + Number(t.grossAmount), 0)

  const recentTripletRows = [...(triplets as InvoiceTripletRow[])]
    .filter((t) => milestoneIdsForAgency.has(t.milestoneId))
    .sort((a, b) => parseTs(b.updatedAt).getTime() - parseTs(a.updatedAt).getTime())
    .slice(0, 10)

  const dealById = new Map(dealsList.map((d) => [d.id, d]))

  const recentTriplets = recentTripletRows.map((t) => {
    const milestoneRow = (milestonesForDeals ?? []).find((m) => m.id === t.milestoneId)
    const deal = milestoneRow ? dealById.get(milestoneRow.dealId) : undefined
    return {
      id: t.id,
      timestamp: parseTs(t.updatedAt),
      approvalStatus: t.approvalStatus,
      invNumber: t.invNumber,
      obiNumber: t.obiNumber,
      milestone: {
        deal: {
          id: deal?.id ?? '',
          title: deal?.title ?? '',
          talent: { name: deal ? talentMap.get(deal.talentId) ?? '' : '' },
        },
      },
    }
  })

  const deals = dealsList.map((deal) => ({
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    probability: deal.probability,
    commissionRate: deal.commissionRate,
    createdAt: parseTs(deal.createdAt),
    client: { name: clientMap.get(deal.clientId) ?? '' },
    talent: { name: talentMap.get(deal.talentId) ?? '' },
    milestones: milestonesByDeal.get(deal.id) ?? [],
  }))

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

  const totalGross = deals.reduce(
    (sum, deal) => sum + deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0),
    0,
  )
  const totalWeighted = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    return sum + totalDealValue * (deal.probability / 100)
  }, 0)
  const totalCommission = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    return sum + totalDealValue * (Number(deal.commissionRate) / 100)
  }, 0)
  const weightedCommission = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    const weightedDealValue = totalDealValue * (deal.probability / 100)
    return sum + weightedDealValue * (Number(deal.commissionRate) / 100)
  }, 0)
  const totalBilled = totalBilledSum
  const totalPaid = totalPaidSum
  const commissionRateConversion = totalGross > 0 ? Math.round((totalCommission / totalGross) * 100) : 0
  const paidConversion = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0

  const stageSummary = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.stage] = (acc[deal.stage] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]))
  const jobsByTalent = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.talent.name] = (acc[deal.talent.name] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const jobsByClient = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.client.name] = (acc[deal.client.name] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  type ActivityItem = {
    id: string
    timestamp: Date
    title: string
    detail: string
    href: string
  }

  const activities: ActivityItem[] = [
    ...deals.map((d) => ({
      id: `deal-${d.id}`,
      timestamp: d.createdAt,
      title: 'New Deal Created',
      detail: `${d.title} · ${d.talent.name}`,
      href: `/agency/pipeline/${d.id}`,
    })),
    ...recentTriplets.map((t) => ({
      id: `triplet-${t.id}`,
      timestamp: t.timestamp,
      title: `Invoice ${t.approvalStatus === 'PENDING' ? 'Generated' : t.approvalStatus}`,
      detail: `${t.invNumber || t.obiNumber || 'Draft'} · ${t.milestone.deal.title}`,
      href: `/agency/pipeline/${t.milestone.deal.id}`,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Agency Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview for {agency?.name ?? 'your agency'}.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Deals</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{deals.length}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Pending Invoice Approvals</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{pendingTriplets}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Pipeline Gross</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalGross)}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Weighted Pipeline</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalWeighted)}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Commission</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalCommission)}</p>
          <p className="text-xs text-zinc-500 mt-2">{commissionRateConversion}% estimated across pipeline gross</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Weighted Commission</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(weightedCommission)}</p>
          <p className="text-xs text-zinc-500 mt-2">Probability-adjusted estimate</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Billed</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalBilled)}</p>
          <p className="text-xs text-zinc-500 mt-2">
            {paidConversion}% of billed value paid (gross: {formatCurrency(totalPaid)})
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Stage Snapshot</h2>
          <div className="space-y-2">
            {stageSummary.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              stageSummary.map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-700">{STAGE_LABEL[stage] ?? stage}</span>
                  <span className="text-sm font-bold text-zinc-900">{count}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-3">Open deliverables pending approval: {pendingDeliverables}</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Total Jobs by Talent</h2>
          <div className="space-y-2">
            {jobsByTalent.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              jobsByTalent.map(([talentName, count]) => (
                <div key={talentName} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-700">{talentName}</p>
                  <p className="text-sm font-bold text-zinc-900">{count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Total Jobs by Client</h2>
          <div className="space-y-2">
            {jobsByClient.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              jobsByClient.map(([clientName, count]) => (
                <div key={clientName} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-700">{clientName}</p>
                  <p className="text-sm font-bold text-zinc-900">{count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {activities.map((activity) => (
              <a
                key={activity.id}
                href={activity.href}
                className="block rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-0.5">
                  <p className="text-sm font-semibold text-zinc-900">{activity.title}</p>
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">
                    {new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(activity.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">{activity.detail}</p>
              </a>
            ))}
            {activities.length === 0 ? <p className="text-sm text-zinc-500">No activity yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
