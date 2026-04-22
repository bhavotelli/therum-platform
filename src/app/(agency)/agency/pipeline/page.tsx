import Link from 'next/link'
import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { wrapPostgrestError } from '@/lib/errors'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { ClientRow, DealRow, MilestoneRow, TalentRow } from '@/types/database'
import DealsViewManager from './DealsViewManager'

export const dynamic = 'force-dynamic'
const STAGE_PROBABILITY: Record<string, number> = {
  PIPELINE: 10,
  NEGOTIATING: 40,
  CONTRACTED: 80,
  ACTIVE: 100,
  IN_BILLING: 100,
  COMPLETED: 100,
}

export default async function DealsDashboard() {
  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') {
    redirect('/login')
  }
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') {
    notFound()
  }
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-zinc-400">
        <p>No agency linked to this user yet.</p>
      </div>
    )
  }

  const db = getSupabaseServiceRole()
  const { data: agency, error: aErr } = await db
    .from('Agency')
    .select('id, name')
    .eq('id', agencyCtx.agencyId)
    .maybeSingle()
  if (aErr) throw wrapPostgrestError(aErr)
  if (!agency) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-zinc-400">
        <p>Agency not found.</p>
      </div>
    )
  }

  const { data: dealsRaw, error: dErr } = await db
    .from('Deal')
    .select('*')
    .eq('agencyId', agency.id)
    .order('createdAt', { ascending: false })
  if (dErr) throw wrapPostgrestError(dErr)
  const dealsList = (dealsRaw ?? []) as DealRow[]
  const dealIds = dealsList.map((d) => d.id)
  const [{ data: milestonesRaw }, { data: clients }, { data: talents }] = await Promise.all([
    dealIds.length ? db.from('Milestone').select('*').in('dealId', dealIds) : { data: [] },
    dealsList.length
      ? db
          .from('Client')
          .select('id, name')
          .in(
            'id',
            [...new Set(dealsList.map((d) => d.clientId))],
          )
      : { data: [] },
    dealsList.length
      ? db
          .from('Talent')
          .select('id, name')
          .in(
            'id',
            [...new Set(dealsList.map((d) => d.talentId))],
          )
      : { data: [] },
  ])

  const milestonesByDeal = new Map<string, MilestoneRow[]>()
  for (const m of (milestonesRaw ?? []) as MilestoneRow[]) {
    const list = milestonesByDeal.get(m.dealId) ?? []
    list.push(m)
    milestonesByDeal.set(m.dealId, list)
  }
  const clientMap = new Map((clients ?? [] as ClientRow[]).map((c) => [c.id, c.name]))
  const talentMap = new Map((talents ?? [] as TalentRow[]).map((t) => [t.id, t.name]))

  const mappedDeals = dealsList.map((deal) => {
    const dealMilestones = milestonesByDeal.get(deal.id) ?? []
    const milestonesCount = dealMilestones.length
    const completedCount = dealMilestones.filter(
      (m) =>
        m.status === 'COMPLETE' || m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY',
    ).length
    const milestoneGreenCount = dealMilestones.filter((m) => m.status === 'PAID' || m.status === 'PAYOUT_READY').length
    const milestoneOrangeCount = dealMilestones.filter((m) => m.status === 'INVOICED').length
    const activeCount = dealMilestones.filter((m) => m.status !== 'CANCELLED').length
    const milestoneRedCount = Math.max(0, activeCount - milestoneOrangeCount - milestoneGreenCount)
    const billedCount = dealMilestones.filter(
      (m) => m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY',
    ).length
    const paidCount = dealMilestones.filter((m) => m.status === 'PAID' || m.status === 'PAYOUT_READY').length

    const invoicedValue = dealMilestones
      .filter((m) => m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY')
      .reduce((sum, m) => sum + Number(m.grossAmount), 0)
    const isCompleted = milestonesCount > 0 && completedCount === milestonesCount
    const progressPercentage = milestonesCount > 0 ? (completedCount / milestonesCount) * 100 : 0
    const billingProgressPercentage = billedCount > 0 ? (paidCount / billedCount) * 100 : 0
    const billingState: 'NOT_STARTED' | 'PAID' | 'BILLED' =
      billedCount === 0 ? 'NOT_STARTED' : paidCount === billedCount ? 'PAID' : 'BILLED'
    const totalValue = dealMilestones.reduce((sum, milestone) => sum + Number(milestone.grossAmount), 0)

    return {
      id: deal.id,
      dealNumber: deal.dealNumber ?? null,
      title: deal.title,
      client: clientMap.get(deal.clientId) ?? '',
      talent: talentMap.get(deal.talentId) ?? '',
      stage: deal.stage,
      probability: deal.probability ?? STAGE_PROBABILITY[deal.stage] ?? 0,
      milestonesCount,
      completedCount,
      isCompleted,
      progressPercentage,
      milestoneRedCount,
      milestoneOrangeCount,
      milestoneGreenCount,
      billedCount,
      paidCount,
      billingProgressPercentage,
      billingState,
      totalValue,
      invoicedValue,
      weightedValue: totalValue * ((deal.probability ?? STAGE_PROBABILITY[deal.stage] ?? 0) / 100),
    }
  })

  const totalDeals = mappedDeals.length
  const activeDeals = mappedDeals.filter((deal) => deal.stage === 'ACTIVE').length
  const totalPipelineValue = mappedDeals.reduce((sum, deal) => sum + deal.totalValue, 0)
  const totalWeightedValue = mappedDeals.reduce((sum, deal) => sum + deal.weightedValue, 0)
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

  return (
    <div className="min-h-full font-sans selection:bg-indigo-500/30 pb-12">
      {/* Integrated Module Card */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden flex flex-col">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Deals</h1>
            <p className="text-gray-500 text-sm">Manage and track all ongoing deals and milestones for {agency.name}.</p>
          </div>
          <Link
            href="/agency/pipeline/new"
            className="h-10 px-5 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm active:scale-95 duration-200 flex items-center"
          >
            + New Deal
          </Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100 bg-white">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-500">Total Deals</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{totalDeals}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-500">Active Deals</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{activeDeals}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-500">Pipeline Gross</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(totalPipelineValue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-500">Weighted Value</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(totalWeightedValue)}</p>
          </div>
        </section>

        {/* View Selection Manager */}
        <div className="bg-white">
          <DealsViewManager deals={mappedDeals} />
        </div>
      </div>
    </div>
  )
}
