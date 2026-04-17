import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import React from 'react'
import MarkCompleteButton from './MarkCompleteButton'
import DealExpensesContainer from './DealExpensesContainer'
import DealWorkspacePanel from './DealWorkspacePanel'
import MilestoneDeliverablesPanel from './MilestoneDeliverablesPanel'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ tab?: string }>

export default async function DealDetailPage(props: { params: Params, searchParams: SearchParams }) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { id } = params
  const activeTab = searchParams.tab || 'milestones'

  // Ensure the ID is a valid UUID before calling Prisma to prevent a crash
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isValidUUID) {
    notFound()
  }

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      client: true,
      talent: true,
      milestones: {
        include: {
          invoiceTriplet: true,
          deliverables: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          invoiceDate: 'asc',
        },
      },
      expenses: {
        include: {
          approvedBy: true,
        },
        orderBy: {
          createdAt: 'desc',
        }
      }
    },
  })

  if (!deal) {
    notFound()
  }

  const formatCurrency = (amount: any) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: deal.currency || 'GBP',
    }).format(Number(amount))
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  // Calculate generic totals
  const totalGross = deal.milestones.reduce((acc, m) => acc + Number(m.grossAmount), 0)
  const completedMilestones = deal.milestones.filter(
    (m) => m.status === 'COMPLETE' || m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY'
  ).length
  const progressPercentage = deal.milestones.length > 0 
    ? Math.round((completedMilestones / deal.milestones.length) * 100) 
    : 0

  const statusStyle = (status: string) => {
    if (status === 'APPROVED' || status === 'COMPLETE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'SUBMITTED') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (status === 'PENDING') return 'bg-gray-50 text-gray-600 border-gray-200'
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return (
    <div className="min-h-full font-sans selection:bg-indigo-500/30 pb-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="space-y-4">
          <Link 
            href="/agency/pipeline" 
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Deals
          </Link>

          <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm relative overflow-hidden">
            {/* Background Gradient flair */}
            <div className="absolute top-0 right-0 w-96 h-96 opacity-10 bg-indigo-500 blur-3xl rounded-full transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
            
            <div className="space-y-4 relative z-10 w-full">
              <div>
                <div className="inline-flex items-center px-2.5 py-1 mb-4 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                  {deal.stage.replace('_', ' ')}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                    {deal.title}
                  </h1>
                  <Link 
                    href={`/agency/pipeline/${deal.id}/edit`}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Deal
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
                  <span className="bg-gray-100 px-3 py-1 rounded-full">{deal.client.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block"></span>
                  <span className="bg-gray-100 px-3 py-1 rounded-full">{deal.talent.name}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-8 pt-6 border-t border-gray-100 mt-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Total Value</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalGross)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Commission Rate</p>
                  <p className="text-xl font-bold text-gray-900">{Number(deal.commissionRate)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Milestones</p>
                  <p className="text-xl font-bold text-gray-900">
                    {completedMilestones} <span className="text-gray-400 text-sm font-medium">/ {deal.milestones.length}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-center min-w-[140px] shrink-0 mt-4 md:mt-0">
              <div className="relative flex items-center justify-center">
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle
                    className="text-gray-100"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="48"
                    cx="56"
                    cy="56"
                  />
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

        {/* Tabs Switcher */}
        <div className="flex items-center gap-1 p-1 bg-gray-100/50 rounded-xl border border-gray-200">
          <Link
            href={`/agency/pipeline/${deal.id}?tab=milestones`}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'milestones'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Milestones
          </Link>
          <Link
            href={`/agency/pipeline/${deal.id}?tab=expenses`}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'expenses'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Expenses
          </Link>
          <Link
            href={`/agency/pipeline/${deal.id}?tab=workspace`}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'workspace'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes & Files
          </Link>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'milestones' ? (
          <section className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Milestone Timeline</h2>
            </div>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
            {deal.milestones.length === 0 ? (
              <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-2xl bg-white shadow-sm">
                No milestones found for this deal.
              </div>
            ) : (
              deal.milestones.map((milestone, index) => {
                const isComplete = milestone.status !== 'PENDING' && milestone.status !== 'CANCELLED'

                return (
                  <div key={milestone.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon indicator */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${
                      isComplete 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isComplete ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg text-gray-900">
                          {milestone.description}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border shadow-sm ${
                            isComplete 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                            {milestone.status}
                          </span>
                          {milestone.status === 'PENDING' && (
                            <MarkCompleteButton milestoneId={milestone.id} />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1 font-medium">Gross Amount</p>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(milestone.grossAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1 font-medium">Invoice Date</p>
                          <p className="font-semibold text-gray-900">
                            {formatDate(milestone.invoiceDate)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-gray-100 bg-white">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Deliverables</p>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black border ${statusStyle(milestone.status)}`}>
                            {milestone.deliverables.filter((deliverable) => deliverable.status === 'APPROVED').length}/
                            {milestone.deliverables.length} approved
                          </span>
                        </div>
                        <div className="px-4 py-3 text-sm text-gray-600">
                          <MilestoneDeliverablesPanel
                            milestoneId={milestone.id}
                            deliverables={milestone.deliverables.map((deliverable) => ({
                              id: deliverable.id,
                              title: deliverable.title,
                              dueDate: deliverable.dueDate ? deliverable.dueDate.toISOString() : null,
                              status: deliverable.status,
                            }))}
                          />
                        </div>
                      </div>

                      {milestone.invoiceTriplet && (
                        <div className="mt-5 pt-5 border-t border-gray-100 space-y-4 relative">
                          <div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-lg opacity-80 text-[10px] px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold tracking-wider">
                            INVOICE DATA
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">COM Number:</span>
                            <span className="font-mono bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md text-gray-700 text-xs shadow-sm">
                              {milestone.invoiceTriplet.comNumber}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Net Payout:</span>
                            <span className="font-bold text-indigo-600 text-lg">
                              {formatCurrency(milestone.invoiceTriplet.netPayoutAmount)}
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
          currency={deal.currency}
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
