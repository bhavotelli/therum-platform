'use client'

import { useState } from 'react'
import { addPayoutAdjustment, confirmPayoutRun, removePayoutAdjustment } from './actions'
import type { PayoutAdjustment, PayoutQueueItem, PayoutTalentSummary } from './data'
import { DealNumberBadge } from '@/components/deals/DealNumberBadge'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

function AdjustmentRow({ adj, currency }: { adj: PayoutAdjustment; currency: string }) {
  const isDeduction = adj.type === 'DEDUCTION'
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2">
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isDeduction ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
        {isDeduction ? 'Deduction' : 'Reimbursement'}
      </span>
      <p className="flex-1 min-w-0 text-xs text-zinc-700 truncate">{adj.description}</p>
      <p className={`text-sm font-bold shrink-0 ${isDeduction ? 'text-rose-700' : 'text-emerald-700'}`}>
        {isDeduction ? '−' : '+'}{formatCurrency(adj.amount, currency)}
      </p>
      <form action={removePayoutAdjustment}>
        <input type="hidden" name="adjustmentId" value={adj.id} />
        <button
          type="submit"
          className="text-zinc-400 hover:text-rose-600 transition-colors text-xs font-semibold"
          title="Remove adjustment"
        >
          ✕
        </button>
      </form>
    </div>
  )
}

function AddAdjustmentForm({ talentId, currency }: { talentId: string; currency: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        + Add adjustment
      </button>
    )
  }

  return (
    <form
      action={async (fd) => {
        await addPayoutAdjustment(fd)
        setOpen(false)
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"
    >
      <input type="hidden" name="talentId" value={talentId} />
      <input type="hidden" name="currency" value={currency} />
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Type
        <select name="type" required className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 min-w-[140px]">
          <option value="DEDUCTION">Deduction</option>
          <option value="REIMBURSEMENT">Reimbursement</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Amount ({currency})
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 w-28"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex-1 min-w-[180px]">
        Description
        <input
          name="description"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Advance recoup"
          className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
        />
      </label>
      <div className="flex items-center gap-2 pb-0.5">
        <button
          type="submit"
          className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PayoutTalentAccordion({
  queue,
  summary,
}: {
  queue: PayoutQueueItem[]
  summary: PayoutTalentSummary[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byTalent = new Map<string, PayoutQueueItem[]>()
  for (const item of queue) {
    const key = `${item.talentEmail}-${item.currency}`
    const arr = byTalent.get(key) ?? []
    arr.push(item)
    byTalent.set(key, arr)
  }

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Milestone payout queue</h2>
      </div>
      <div className="divide-y divide-zinc-100">
        {summary.map((talent) => {
          const key = `${talent.talentEmail}-${talent.currency}`
          const isOpen = expanded.has(key)
          const items = byTalent.get(key) ?? []
          const hasAdjustments = talent.adjustments.length > 0

          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
              >
                <svg
                  className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{talent.talentName}</p>
                  <p className="text-xs text-zinc-500 truncate">{talent.talentEmail}</p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Milestones</p>
                    <p className="text-sm font-bold text-zinc-700">{talent.milestoneCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gross</p>
                    <p className="text-sm font-bold text-zinc-700">{formatCurrency(talent.totalGross, talent.currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Net Due</p>
                    <p className={`text-sm font-bold ${hasAdjustments ? 'text-amber-700' : 'text-teal-700'}`}>
                      {formatCurrency(talent.adjustedNet, talent.currency)}
                    </p>
                    {hasAdjustments && (
                      <p className="text-[10px] text-zinc-400 line-through">{formatCurrency(talent.totalNet, talent.currency)}</p>
                    )}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50">
                  {/* Milestones table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="px-6 py-2 text-left font-semibold">Deal</th>
                          <th className="px-4 py-2 text-left font-semibold">Milestone</th>
                          <th className="px-4 py-2 text-right font-semibold">Gross</th>
                          <th className="px-4 py-2 text-right font-semibold">Commission</th>
                          <th className="px-4 py-2 text-right font-semibold">Net Due</th>
                          <th className="px-4 py-2 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {items.map((item) => (
                          <tr key={item.milestoneId}>
                            <td className="px-6 py-3 font-medium text-zinc-900">
                              <div className="flex items-center gap-2 flex-wrap">
                                <DealNumberBadge dealNumber={item.dealNumber} />
                                <span>{item.dealTitle}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{item.milestoneDescription}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.grossAmount, item.currency)}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.commissionAmount, item.currency)}</td>
                            <td className="px-4 py-3 text-right font-bold text-teal-700">{formatCurrency(item.netPayoutAmount, item.currency)}</td>
                            <td className="px-4 py-3 text-right">
                              <form action={confirmPayoutRun}>
                                <input type="hidden" name="milestoneIds" value={item.milestoneId} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                >
                                  Mark exported
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Adjustments panel */}
                  <div className="px-5 py-4 border-t border-zinc-100 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Adjustments</p>
                      <AddAdjustmentForm talentId={talent.talentId} currency={talent.currency} />
                    </div>

                    {talent.adjustments.length === 0 ? (
                      <p className="text-xs text-zinc-500">No adjustments. Add a deduction (e.g. advance recoup) or reimbursement to adjust the final payout.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {talent.adjustments.map((adj) => (
                          <AdjustmentRow key={adj.id} adj={adj} currency={talent.currency} />
                        ))}
                      </div>
                    )}

                    {talent.adjustments.length > 0 && (
                      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm space-y-1">
                        <div className="flex justify-between text-zinc-600">
                          <span>Milestone net</span>
                          <span className="font-medium">{formatCurrency(talent.totalNet, talent.currency)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Adjustments</span>
                          <span className={`font-medium ${talent.adjustmentTotal < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {talent.adjustmentTotal >= 0 ? '+' : ''}{formatCurrency(talent.adjustmentTotal, talent.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-zinc-100 pt-1 font-bold">
                          <span className="text-zinc-900">Adjusted net due</span>
                          <span className="text-teal-700">{formatCurrency(talent.adjustedNet, talent.currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
