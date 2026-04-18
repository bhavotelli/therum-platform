import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { DeliverableStatus } from '@/types/database'
import DealExpensesContainer from './DealExpensesContainer'
import DealWorkspacePanel from './DealWorkspacePanel'
import MarkCompleteButton from './MarkCompleteButton'
import MilestoneDeliverablesPanel from './MilestoneDeliverablesPanel'

export const dynamic = 'force-dynamic'

type DealDetailForPage = {
  id: string
  agencyId: string
  title: string
  stage: string
  currency: string | null
  commissionRate: string | number
  notes: string | null
  contractRef: string | null
  client: { id: string; name: string }
  talent: { id: string; name: string }
  milestones: {
    id: string
    description?: string | null
    status?: string
    grossAmount?: string | number
    invoiceDate?: string
    deliverables: {
      id: string
      title: string
      dueDate: string | null
      status: DeliverableStatus
    }[]
    invoiceTriplet: { comNumber?: string | null; netPayoutAmount?: string | number | null } | null
  }[]
  expenses: Record<string, unknown>[]
}

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ tab?: string }>

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  if (!full?.trim()) return { firstName: '', lastName: '' }
  const parts = full.trim().split(/\s+/)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export default async function DealDetailPage(props: { params: Params; searchParams: SearchParams }) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { id } = params
  const activeTab = searchParams.tab || 'milestones'

  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isValidUUID) {
    notFound()
  }

  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') {
    redirect('/login')
  }
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') {
    notFound()
  }
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">No agency linked to this user yet.</div>
    )
  }

  const db = getSupabaseServiceRole()

  const { data: dealRow, error: dealErr } = await db
    .from('Deal')
    .select(
      `*,
      Client (*),
      Talent (*),
      Milestone (
        *,
        InvoiceTriplet (*),
        Deliverable (*)
      ),
      DealExpense (*)
    `,
    )
    .eq('id', id)
    .eq('agencyId', agencyCtx.agencyId)
    .maybeSingle()

  if (dealErr || !dealRow) {
    if (dealErr) console.error(dealErr)
    notFound()
  }

  const client = (dealRow as { Client?: { id: string; name: string } }).Client
  const talent = (dealRow as { Talent?: { id: string; name: string } }).Talent
  const rawMilestones = (dealRow as { Milestone?: Record<string, unknown>[] }).Milestone
  const rawExpenses = (dealRow as { DealExpense?: Record<string, unknown>[] }).DealExpense

  if (!client || !talent) {
    notFound()
  }

  const {
    Client: _Cl,
    Talent: _Ta,
    Milestone: _Mi,
    DealExpense: _De,
    ...dealBase
  } = dealRow as Record<string, unknown> & {
    Client?: unknown
    Talent?: unknown
    Milestone?: unknown
    DealExpense?: unknown
  }
  void _Cl
  void _Ta
  void _Mi
  void _De

  const approverIds = [...new Set((rawExpenses ?? []).map((e) => e.approvedById).filter(Boolean) as string[])]
  const approvers: Record<string, { name: string | null }> = {}
  if (approverIds.length > 0) {
    const { data: users } = await db.from('User').select('id, name').in('id', approverIds)
    for (const u of users ?? []) {
      approvers[u.id] = { name: u.name }
    }
  }

  const milestones = [...(rawMilestones ?? [])].sort((a, b) => {
    const ad = String(a.invoiceDate ?? '')
    const bd = String(b.invoiceDate ?? '')
    return ad.localeCompare(bd)
  })

  const b = dealBase as Record<string, unknown>
  const deal: DealDetailForPage = {
    id: String(b.id),
    agencyId: String(b.agencyId),
    title: String(b.title ?? ''),
    stage: String(b.stage ?? ''),
    currency: (b.currency as string | null) ?? null,
    commissionRate: b.commissionRate as string | number,
    notes: (b.notes as string | null) ?? null,
    contractRef: (b.contractRef as string | null) ?? null,
    client,
    talent,
    milestones: milestones.map((m) => {
      const inv = (m as { InvoiceTriplet?: Record<string, unknown> | Record<string, unknown>[] | null }).InvoiceTriplet
      const del = (m as { Deliverable?: Record<string, unknown>[] }).Deliverable ?? []
      const tripletObj = Array.isArray(inv) ? inv[0] ?? null : inv ?? null
      const deliverablesSorted = [...del].sort((x, y) =>
        String((x as { createdAt?: string }).createdAt ?? '').localeCompare(String((y as { createdAt?: string }).createdAt ?? '')),
      )
      return {
        id: m.id as string,
        description: m.description as string | undefined,
        status: m.status as string | undefined,
        grossAmount: m.grossAmount as string | number | undefined,
        invoiceDate: m.invoiceDate as string | undefined,
        invoiceTriplet: tripletObj,
        deliverables: deliverablesSorted.map((d) => ({
          id: d.id as string,
          title: d.title as string,
          dueDate: d.dueDate != null ? String(d.dueDate) : null,
          status: d.status as DeliverableStatus,
        })),
      }
    }),
    expenses: (rawExpenses ?? []).map((e) => {
      const uid = e.approvedById as string | null
      const nm = uid ? approvers[uid]?.name : null
      const { firstName, lastName } = splitName(nm)
      return {
        ...e,
        amount: String(e.amount),
        createdAt: e.createdAt,
        approvedBy: uid ? { firstName, lastName } : null,
      }
    }),
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: deal.currency || 'GBP',
    }).format(Number(amount))
  }

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  const totalGross = deal.milestones.reduce((acc, m) => acc + Number((m as { grossAmount?: string }).grossAmount), 0)
  const completedMilestones = deal.milestones.filter((m) => {
    const s = (m as { status?: string }).status
    return s === 'COMPLETE' || s === 'INVOICED' || s === 'PAID' || s === 'PAYOUT_READY'
  }).length
  const progressPercentage =
    deal.milestones.length > 0 ? Math.round((completedMilestones / deal.milestones.length) * 100) : 0

  const statusStyle = (status: string) => {
    if (status === 'APPROVED' || status === 'COMPLETE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'SUBMITTED') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (status === 'PENDING') return 'bg-gray-50 text-gray-600 border-gray-200'
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return (
    <div className="min-h-full font-sans selection:bg-indigo-500/30 pb-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <Link
            href="/agency/pipeline"
            className="inline-flex items-center text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Deals
          </Link>

          <header className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:flex-row md:items-start">
            <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/3 transform rounded-full bg-indigo-500/10 opacity-10 blur-3xl"></div>

            <div className="relative z-10 w-full space-y-4">
              <div>
                <div className="mb-4 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                  {String(deal.stage).replace('_', ' ')}
                </div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900">{deal.title}</h1>
                  <Link
                    href={`/agency/pipeline/${deal.id}/edit`}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-100"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Deal
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1">{deal.client.name}</span>
                  <span className="block h-1.5 w-1.5 rounded-full bg-gray-300"></span>
                  <span className="rounded-full bg-gray-100 px-3 py-1">{deal.talent.name}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-8 border-t border-gray-100 pt-6">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Total Value</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalGross)}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Commission Rate</p>
                  <p className="text-xl font-bold text-gray-900">{Number(deal.commissionRate)}%</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Milestones</p>
                  <p className="text-xl font-bold text-gray-900">
                    {completedMilestones}{' '}
                    <span className="text-sm font-medium text-gray-400">/ {deal.milestones.length}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-4 flex min-w-[140px] shrink-0 items-center justify-center md:mt-0">
              <div className="relative flex items-center justify-center">
                <svg className="h-28 w-28 -rotate-90 transform">
                  <circle className="text-gray-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="48" cx="56" cy="56" />
                  <circle
                    className="text-indigo-500 transition-all duration-1000 ease-in-out"
                    strokeWidth="8"
                    strokeDasharray={48 * 2 * Math.PI}
                    strokeDashoffset={48 * 2 * Math.PI - (progressPercentage / 100) * 48 * 2 * Math.PI}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="48"
                    cx="56"
                    cy="56"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-bold text-gray-900">{progressPercentage}%</span>
                </div>
              </div>
            </div>
          </header>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/50 p-1">
          <Link
            href={`/agency/pipeline/${deal.id}?tab=milestones`}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-4 text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'milestones'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Milestones
          </Link>
          <Link
            href={`/agency/pipeline/${deal.id}?tab=expenses`}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-4 text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'expenses'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Expenses
          </Link>
          <Link
            href={`/agency/pipeline/${deal.id}?tab=workspace`}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-4 text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'workspace'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Notes & Files
          </Link>
        </div>

        {activeTab === 'milestones' ? (
          <section className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Milestone Timeline</h2>
            </div>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent before:h-full before:w-0.5 md:before:mx-auto md:before:translate-x-0">
              {deal.milestones.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-gray-500 shadow-sm">
                  No milestones found for this deal.
                </div>
              ) : (
                deal.milestones.map((milestone) => {
                  const m = milestone
                  const isComplete = m.status !== 'PENDING' && m.status !== 'CANCELLED'
                  const deliverables = m.deliverables ?? []

                  return (
                    <div
                      key={m.id}
                      className="group is-active relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse"
                    >
                      <div
                        className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                          isComplete ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isComplete ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="h-2.5 w-2.5 rounded-full bg-gray-400"></div>
                        )}
                      </div>

                      <div className="w-[calc(100%-4rem)] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-gray-300 hover:shadow-md md:w-[calc(50%-2.5rem)]">
                        <div className="mb-4 flex items-start justify-between">
                          <h3 className="text-lg font-bold text-gray-900">{m.description}</h3>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm ${
                                isComplete
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-600'
                              }`}
                            >
                              {m.status}
                            </span>
                            {m.status === 'PENDING' && <MarkCompleteButton milestoneId={m.id} />}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                          <div>
                            <p className="mb-1 text-xs font-medium text-gray-500">Gross Amount</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(m.grossAmount ?? 0)}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-gray-500">Invoice Date</p>
                            <p className="font-semibold text-gray-900">{formatDate(m.invoiceDate ?? '')}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-100 bg-white">
                          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Deliverables</p>
                            <span
                              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black ${statusStyle(m.status ?? '')}`}
                            >
                              {deliverables.filter((deliverable) => deliverable.status === 'APPROVED').length}/
                              {deliverables.length} approved
                            </span>
                          </div>
                          <div className="px-4 py-3 text-sm text-gray-600">
                            <MilestoneDeliverablesPanel
                              milestoneId={m.id}
                              deliverables={deliverables}
                            />
                          </div>
                        </div>

                        {m.invoiceTriplet && (
                          <div className="relative mt-5 space-y-4 border-t border-gray-100 pt-5">
                            <div className="absolute right-0 top-0 rounded-bl-xl rounded-tr-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-indigo-700 opacity-80">
                              INVOICE DATA
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-500">COM Number:</span>
                              <span className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-xs text-gray-700 shadow-sm">
                                {m.invoiceTriplet.comNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-500">Net Payout:</span>
                              <span className="text-lg font-bold text-indigo-600">
                                {formatCurrency(m.invoiceTriplet.netPayoutAmount ?? 0)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        ) : activeTab === 'expenses' ? (
          <DealExpensesContainer
            expenses={deal.expenses}
            dealId={deal.id}
            agencyId={deal.agencyId}
            currency={deal.currency ?? 'GBP'}
          />
        ) : (
          <DealWorkspacePanel
            dealId={deal.id}
            initialNotes={deal.notes ?? ''}
            initialContractRef={deal.contractRef ?? ''}
          />
        )}
      </div>
    </div>
  )
}
