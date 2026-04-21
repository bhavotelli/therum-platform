import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { getVatMonitoringForAgency } from '@/lib/vat-monitoring'
import { VatAlertBanner } from '@/components/shared/VatAlertBanner'
import type {
  ClientRow,
  DealRow,
  DeliverableRow,
  InvoiceTripletRow,
  MilestoneRow,
  TalentRow,
} from '@/types/database'

const STAGE_ORDER = ['PIPELINE', 'NEGOTIATING', 'CONTRACTED', 'ACTIVE', 'IN_BILLING', 'COMPLETED']
const STAGE_LABEL: Record<string, string> = {
  PIPELINE: 'Prospect',
  NEGOTIATING: 'Negotiating',
  CONTRACTED: 'Contracting',
  ACTIVE: 'Active',
  IN_BILLING: 'In Billing',
  COMPLETED: 'Completed',
}
const STAGE_COLOR: Record<string, string> = {
  PIPELINE: 'bg-zinc-300',
  NEGOTIATING: 'bg-indigo-300',
  CONTRACTED: 'bg-amber-400',
  ACTIVE: 'bg-blue-400',
  IN_BILLING: 'bg-teal-400',
  COMPLETED: 'bg-emerald-500',
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
  if (aErr) throw new Error(aErr.message)

  const { data: dealsRaw, error: dErr } = await db
    .from('Deal')
    .select('id, title, stage, probability, commissionRate, createdAt, clientId, talentId')
    .eq('agencyId', agencyId)
    .order('createdAt', { ascending: false })
  if (dErr) throw new Error(dErr.message)
  const dealsList = (dealsRaw ?? []) as DealRow[]
  const dealIds = dealsList.map((d) => d.id)

  const { data: milestonesForDeals, error: mErr } = dealIds.length
    ? await db.from('Milestone').select('id, dealId, grossAmount, status').in('dealId', dealIds)
    : { data: [], error: null }
  if (mErr) throw new Error(mErr.message)

  const milestoneIds = (milestonesForDeals ?? []).map((m) => m.id)

  const [
    [{ data: clientRows }, { data: talentRows }, { data: allTriplets }, { data: allDeliverables }],
    vatStatuses,
  ] = await Promise.all([
    Promise.all([
      dealsList.length
        ? db.from('Client').select('id, name').in('id', [...new Set(dealsList.map((d) => d.clientId))])
        : { data: [] },
      dealsList.length
        ? db.from('Talent').select('id, name').in('id', [...new Set(dealsList.map((d) => d.talentId))])
        : { data: [] },
      milestoneIds.length ? db.from('InvoiceTriplet').select('*').in('milestoneId', milestoneIds) : { data: [] },
      milestoneIds.length
        ? db.from('Deliverable').select('id, status, milestoneId').in('milestoneId', milestoneIds)
        : { data: [] },
    ]),
    getVatMonitoringForAgency(agencyId),
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

  const recentTripletRows = [...triplets]
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
    (sum, deal) => sum + deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0), 0)
  const totalWeighted = deals.reduce((sum, deal) => {
    const v = deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0)
    return sum + v * (deal.probability / 100)
  }, 0)
  const weightedCommission = deals.reduce((sum, deal) => {
    const v = deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0)
    return sum + v * (deal.probability / 100) * (Number(deal.commissionRate) / 100)
  }, 0)
  const paidPct = totalBilledSum > 0 ? Math.round((totalPaidSum / totalBilledSum) * 100) : 0

  // Value by stage
  const stageData = deals.reduce<Record<string, { count: number; value: number }>>((acc, deal) => {
    const v = deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0)
    if (!acc[deal.stage]) acc[deal.stage] = { count: 0, value: 0 }
    acc[deal.stage].count++
    acc[deal.stage].value += v
    return acc
  }, {})
  const stageEntries = STAGE_ORDER.filter((s) => stageData[s]).map((s) => [s, stageData[s]] as [string, { count: number; value: number }])
  const maxStageValue = Math.max(...stageEntries.map(([, d]) => d.value), 1)

  // Value by talent
  const valueByTalent = new Map<string, number>()
  for (const deal of deals) {
    const v = deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0)
    valueByTalent.set(deal.talent.name, (valueByTalent.get(deal.talent.name) ?? 0) + v)
  }
  const topTalent = [...valueByTalent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxTalentValue = topTalent[0]?.[1] ?? 1

  // Value by client
  const valueByClient = new Map<string, number>()
  for (const deal of deals) {
    const v = deal.milestones.reduce((s, m) => s + Number(m.grossAmount), 0)
    valueByClient.set(deal.client.name, (valueByClient.get(deal.client.name) ?? 0) + v)
  }
  const topClients = [...valueByClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxClientValue = topClients[0]?.[1] ?? 1

  type ActivityItem = { id: string; timestamp: Date; title: string; detail: string; href: string }
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
    .slice(0, 8)

  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{today}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{agency?.name ?? 'Your Agency'}</h1>
            <p className="mt-0.5 text-sm text-gray-500">Agency dashboard — {deals.length} deal{deals.length !== 1 ? 's' : ''} in pipeline</p>
          </div>
          <Link
            href="/agency/pipeline"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-100"
          >
            View Pipeline
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      <VatAlertBanner statuses={vatStatuses} viewAllHref="/agency/vat-monitor" />

      {/* Action callouts */}
      {(pendingTriplets > 0 || pendingDeliverables > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pendingTriplets > 0 && (
            <Link
              href="/finance/invoices"
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 transition-colors hover:bg-amber-100"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-bold text-amber-900">{pendingTriplets} invoice{pendingTriplets !== 1 ? 's' : ''} awaiting approval</p>
                  <p className="text-xs text-amber-700">Pending Finance Portal review</p>
                </div>
              </div>
              <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          {pendingDeliverables > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-blue-900">{pendingDeliverables} deliverable{pendingDeliverables !== 1 ? 's' : ''} pending approval</p>
                <p className="text-xs text-blue-700">Open across active milestones</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pipeline Gross</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(totalGross)}</p>
          <p className="mt-1 text-xs text-gray-400">{deals.length} deal{deals.length !== 1 ? 's' : ''} across all stages</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Weighted Pipeline</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-indigo-700">{formatCurrency(totalWeighted)}</p>
          <p className="mt-1 text-xs text-indigo-400">Probability-adjusted value</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Weighted Commission</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(weightedCommission)}</p>
          <p className="mt-1 text-xs text-gray-400">Expected agency earnings</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Billed vs Paid</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(totalPaidSum)}</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>of {formatCurrency(totalBilledSum)} billed</span>
              <span className="font-semibold tabular-nums text-emerald-600">{paidPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom panels */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Stage snapshot */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Pipeline by Stage</h2>
          {stageEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No deals yet.</p>
          ) : (
            <div className="space-y-3">
              {stageEntries.map(([stage, data]) => (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STAGE_COLOR[stage] ?? 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-gray-700">{STAGE_LABEL[stage] ?? stage}</span>
                      <span className="text-xs text-gray-400">{data.count} deal{data.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-gray-700">{formatCurrency(data.value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${STAGE_COLOR[stage] ?? 'bg-gray-300'}`}
                      style={{ width: `${Math.round((data.value / maxStageValue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Recent Activity</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{activity.detail}</p>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                    {new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(activity.timestamp)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top talent by value */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Top Talent by Deal Value</h2>
          {topTalent.length === 0 ? (
            <p className="text-sm text-gray-400">No deals yet.</p>
          ) : (
            <div className="space-y-3">
              {topTalent.map(([name, value]) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 truncate pr-2">{name}</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 shrink-0">{formatCurrency(value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-700"
                      style={{ width: `${Math.round((value / maxTalentValue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clients by value */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Top Clients by Deal Value</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-gray-400">No deals yet.</p>
          ) : (
            <div className="space-y-3">
              {topClients.map(([name, value]) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 truncate pr-2">{name}</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 shrink-0">{formatCurrency(value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-teal-400 transition-all duration-700"
                      style={{ width: `${Math.round((value / maxClientValue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>
    </div>
  )
}
