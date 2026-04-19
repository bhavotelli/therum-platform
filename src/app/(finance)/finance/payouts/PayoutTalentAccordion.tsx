'use client'

import { useState } from 'react'
import { confirmPayoutRun } from './actions'
import type { PayoutQueueItem, PayoutTalentSummary } from './data'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
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
                    <p className="text-sm font-bold text-teal-700">{formatCurrency(talent.totalNet, talent.currency)}</p>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50 overflow-x-auto">
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
                          <td className="px-6 py-3 font-medium text-zinc-900">{item.dealTitle}</td>
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
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
