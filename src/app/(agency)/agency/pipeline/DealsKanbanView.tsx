'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getDealActivationReadiness, updateDealProbability, updateDealStage } from './actions'
import { DealNumberBadge } from '@/components/deals/DealNumberBadge'
import type { DealStage } from '@/types/database'

type DealProps = {
  id: string;
  dealNumber: string | null;
  title: string;
  client: string;
  talent: string;
  stage: string;
  probability: number;
  milestonesCount: number;
  completedCount: number;
  isCompleted: boolean;
  progressPercentage: number;
  milestoneRedCount: number;
  milestoneOrangeCount: number;
  milestoneGreenCount: number;
  billedCount: number;
  paidCount: number;
  billingProgressPercentage: number;
  billingState: 'NOT_STARTED' | 'BILLED' | 'PAID';
  totalValue: number;
  invoicedValue: number;
  weightedValue: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

type ReadinessItem = {
  id: string
  status: 'pass' | 'warn' | 'block'
  message: string
}

type ActivationModalState = {
  dealId: string
  dealTitle: string
  checklist: ReadinessItem[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to move deal. Please try again.'
}

const STAGES = [
  { id: 'PIPELINE', name: 'Prospect', color: 'bg-gray-100 text-gray-600' },
  { id: 'NEGOTIATING', name: 'Negotiating', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'CONTRACTED', name: 'Contracting', color: 'bg-amber-100 text-amber-700' },
  { id: 'ACTIVE', name: 'Active', color: 'bg-blue-100 text-blue-700' },
  { id: 'IN_BILLING', name: 'In Billing', color: 'bg-teal-100 text-teal-700' },
  { id: 'COMPLETED', name: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
]

const PRE_ACTIVE_STAGES = new Set(['PIPELINE', 'NEGOTIATING', 'CONTRACTED'])
const DRAGGABLE_STAGES = new Set(['PIPELINE', 'NEGOTIATING', 'CONTRACTED', 'ACTIVE'])
const stageLabel = (stage: string) =>
  stage === 'PIPELINE'
    ? 'PROSPECT'
    : stage === 'CONTRACTED'
      ? 'CONTRACTING'
      : stage === 'IN_BILLING'
        ? 'IN BILLING'
        : stage.replace('_', ' ')

export default function DealsKanbanView({ deals: initialDeals }: { deals: DealProps[] }) {
  const router = useRouter()
  const [localDeals, setLocalDeals] = useState<DealProps[]>(initialDeals)
  const [draggingOver, setDraggingOver] = useState<string | null>(null)
  const [activationModal, setActivationModal] = useState<ActivationModalState | null>(null)
  const [ackWarnings, setAckWarnings] = useState(false)
  const [activationPending, setActivationPending] = useState(false)
  const [probabilitySavingDealId, setProbabilitySavingDealId] = useState<string | null>(null)

  // Sync with initialDeals if they change from server
  useEffect(() => {
    setLocalDeals(initialDeals)
  }, [initialDeals])

  const onDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDraggingOver(stageId)
  }

  const onDrop = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault()
    setDraggingOver(null)
    const dealId = e.dataTransfer.getData('dealId')
    
    // Find the current deal to check if it's already in the target stage
    const deal = localDeals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return
    if (deal.stage === 'COMPLETED') return

    if (deal.stage === 'CONTRACTED' && targetStage === 'ACTIVE') {
      try {
        const checklist = await getDealActivationReadiness(dealId)
        setAckWarnings(false)
        setActivationModal({
          dealId,
          dealTitle: deal.title,
          checklist,
        })
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
      return
    }

    try {
      await moveDealStage(dealId, targetStage)
      const targetLabel = STAGES.find((s) => s.id === targetStage)?.name ?? targetStage
      toast.success(`${deal.title} moved to ${targetLabel}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const moveDealStage = async (dealId: string, targetStage: DealStage, acknowledgedWarningIds?: string[]) => {
    const previousDeals = [...localDeals]
    const updatedDeals = localDeals.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d))
    setLocalDeals(updatedDeals)
    try {
      const result = await updateDealStage(dealId, targetStage, { acknowledgedWarningIds })
      if (!result.success) throw new Error('Failed to update stage')
    } catch (error) {
      console.error(error)
      setLocalDeals(previousDeals)
      throw error
    }
  }

  const handleConfirmActivation = async () => {
    if (!activationModal) return
    const warningItems = activationModal.checklist.filter((item) => item.status === 'warn')
    const blockItems = activationModal.checklist.filter((item) => item.status === 'block')
    if (blockItems.length > 0) return
    if (warningItems.length > 0 && !ackWarnings) return

    setActivationPending(true)
    try {
      await moveDealStage(
        activationModal.dealId,
        'ACTIVE',
        warningItems.map((item) => item.id),
      )
      toast.success(`${activationModal.dealTitle} activated`)
      setActivationModal(null)
      setAckWarnings(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setActivationPending(false)
    }
  }

  const groupedDeals = STAGES.reduce((acc, stage) => {
    acc[stage.id] = localDeals.filter(d => d.stage === stage.id)
    return acc
  }, {} as Record<string, DealProps[]>)

  const updateProbability = async (dealId: string, probability: number) => {
    const normalized = Math.max(0, Math.min(100, Math.round(probability)))
    const previousDeals = [...localDeals]
    setLocalDeals((current) =>
      current.map((deal) =>
        deal.id === dealId
          ? { ...deal, probability: normalized, weightedValue: Math.round((deal.totalValue * normalized) / 100) }
          : deal,
      ),
    )
    setProbabilitySavingDealId(dealId)
    try {
      await updateDealProbability(dealId, normalized)
      // No success toast here — users adjust probability frequently on blur
      // and firing a toast per keystroke would be noisy. Failure still
      // deserves surfacing since the UI optimistically shows the new value.
    } catch (error) {
      setLocalDeals(previousDeals)
      toast.error(getErrorMessage(error))
    } finally {
      setProbabilitySavingDealId(null)
    }
  }

  return (
    <>
      <div className="flex gap-6 p-6 min-h-[700px] overflow-x-auto bg-gray-50/50">
        {STAGES.map((stage) => (
        <div 
          key={stage.id} 
          className={`flex-1 min-w-[300px] flex flex-col gap-4 p-2 rounded-2xl transition-colors duration-200 ${
            draggingOver === stage.id ? 'bg-indigo-50/50 ring-2 ring-indigo-200 ring-dashed' : ''
          }`}
          onDragOver={(e) => onDragOver(e, stage.id)}
          onDragLeave={() => setDraggingOver(null)}
          onDrop={(e) => onDrop(e, stage.id as DealStage)}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between px-2 py-1">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                {stage.name}
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-[10px] tabular-nums">
                  {groupedDeals[stage.id].length}
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">
                Gross: {formatCurrency(groupedDeals[stage.id].reduce((sum, deal) => sum + deal.totalValue, 0))}
              </p>
              <p className="text-[10px] text-gray-400">
                Weighted: {formatCurrency(groupedDeals[stage.id].reduce((sum, deal) => sum + deal.weightedValue, 0))}
              </p>
            </div>
          </div>

          {/* Cards Container */}
          <div className="flex-1 flex flex-col gap-3">
            {groupedDeals[stage.id].length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-3xl h-32 flex items-center justify-center text-gray-300 text-sm italic">
                No deals here
              </div>
            ) : (
              groupedDeals[stage.id].map((deal) => (
                <div 
                  key={deal.id}
                  draggable={DRAGGABLE_STAGES.has(deal.stage)}
                  onDragStart={(e) => onDragStart(e, deal.id)}
                  onClick={() => router.push(`/agency/pipeline/${deal.id}`)}
                  className="group bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-pointer relative overflow-hidden active:scale-[0.98] active:cursor-grabbing"
                >
                  {/* Card Background Accent */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    stage.id === 'COMPLETED' ? 'bg-emerald-500' :
                    stage.id === 'IN_BILLING' ? 'bg-teal-500' :
                    stage.id === 'ACTIVE' ? 'bg-blue-500' :
                    stage.id === 'CONTRACTED' ? 'bg-amber-500' :
                    stage.id === 'NEGOTIATING' ? 'bg-indigo-400' :
                    'bg-gray-300'
                  }`}></div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      {deal.dealNumber && (
                        <DealNumberBadge dealNumber={deal.dealNumber} />
                      )}
                      <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm leading-tight">
                        {deal.title}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 uppercase tracking-tighter text-black">
                          {deal.client}
                        </span>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                          {deal.talent}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                          deal.stage === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : deal.stage === 'IN_BILLING'
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : deal.stage === 'ACTIVE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : deal.stage === 'CONTRACTED'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : deal.stage === 'NEGOTIATING'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {stageLabel(deal.stage)}
                        </span>
                      </div>
                      {PRE_ACTIVE_STAGES.has(deal.stage) ? (
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Probability</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={deal.probability}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const next = Number(event.target.value) || 0
                              setLocalDeals((current) =>
                                current.map((item) =>
                                  item.id === deal.id
                                    ? { ...item, probability: Math.max(0, Math.min(100, Math.round(next))) }
                                    : item,
                                ),
                              )
                            }}
                            onBlur={(event) => {
                              void updateProbability(deal.id, Number(event.target.value) || 0)
                            }}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs font-mono text-gray-700"
                          />
                          <span className="text-[10px] text-gray-400">
                            {probabilitySavingDealId === deal.id ? 'Saving...' : '%'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Probability locked at 100%</div>
                      )}
                    </div>

                    <div className="space-y-2 text-black">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1">
                          <p className="text-gray-400 uppercase tracking-wider">Value</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(deal.totalValue)}</p>
                        </div>
                        <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2 py-1">
                          <p className="text-indigo-500 uppercase tracking-wider">Weighted</p>
                          <p className="font-semibold text-indigo-700">{formatCurrency(deal.weightedValue)}</p>
                        </div>
                      </div>

                      {deal.stage === 'ACTIVE' && deal.totalValue > 0 && (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoiced</span>
                            <span className="text-[10px] font-black text-gray-900 tabular-nums">
                              {Math.round((deal.invoicedValue / deal.totalValue) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 transition-all duration-700"
                              style={{ width: `${Math.round((deal.invoicedValue / deal.totalValue) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {(deal.stage === 'IN_BILLING' || deal.stage === 'COMPLETED') && deal.milestonesCount > 0 && (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Billing</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-900">
                              {deal.paidCount}/{deal.milestonesCount} paid
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
                            <div
                              className="h-full bg-rose-400"
                              style={{ width: `${(deal.milestoneRedCount / deal.milestonesCount) * 100}%` }}
                              title={`Not yet invoiced: ${deal.milestoneRedCount}`}
                            />
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${(deal.milestoneOrangeCount / deal.milestonesCount) * 100}%` }}
                              title={`Awaiting payment: ${deal.milestoneOrangeCount}`}
                            />
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${(deal.milestoneGreenCount / deal.milestonesCount) * 100}%` }}
                              title={`Paid: ${deal.milestoneGreenCount}`}
                            />
                          </div>
                          <div className="flex gap-3 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                            {deal.milestoneRedCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                {deal.milestoneRedCount} O/S
                              </span>
                            )}
                            {deal.milestoneOrangeCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {deal.milestoneOrangeCount} Awaiting
                              </span>
                            )}
                            {deal.milestoneGreenCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {deal.milestoneGreenCount} Paid
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                       <span className={`text-[10px] font-black p-1 rounded uppercase tracking-tighter ${
                         deal.isCompleted ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'
                       }`}>
                         {deal.isCompleted ? 'Finished' : 'In Progress'}
                       </span>
                       <div className="flex items-center text-[#1A244E] font-bold text-xs">
                         View Details
                         <svg className="w-3 h-3 ml-1 translate-x-0 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                         </svg>
                       </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        ))}
      </div>

      {activationModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 shadow-xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Readiness Check: Move to Active</h3>
              <p className="text-sm text-gray-500 mt-1">{activationModal.dealTitle}</p>
            </div>
            <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {activationModal.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    item.status === 'pass'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : item.status === 'warn'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  <span className="mr-2">
                    {item.status === 'pass' ? '✓' : item.status === 'warn' ? '⚠' : '✗'}
                  </span>
                  {item.message}
                </div>
              ))}

              {activationModal.checklist.some((item) => item.status === 'warn') ? (
                <label className="flex items-start gap-2 text-sm text-gray-700 pt-2">
                  <input
                    type="checkbox"
                    checked={ackWarnings}
                    onChange={(e) => setAckWarnings(e.target.checked)}
                    className="mt-0.5"
                  />
                  I acknowledge all warnings and want to continue activation.
                </label>
              ) : null}
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivationModal(null)
                  setAckWarnings(false)
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmActivation}
                disabled={
                  activationPending ||
                  activationModal.checklist.some((item) => item.status === 'block') ||
                  (activationModal.checklist.some((item) => item.status === 'warn') && !ackWarnings)
                }
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {activationPending ? 'Activating...' : 'Confirm Move to Active'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

