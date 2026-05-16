'use client'

import React from 'react'

/**
 * Readiness item shape — must stay in sync with `getDealActivationReadiness`
 * in `src/app/(agency)/agency/pipeline/actions.ts`.
 */
export type ReadinessItem = {
  id: string
  status: 'pass' | 'warn' | 'block'
  message: string
}

type DealActivationModalProps = {
  dealTitle: string
  checklist: ReadinessItem[]
  pending: boolean
  ackWarnings: boolean
  onToggleAck: (next: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Presentational modal for the "move deal to ACTIVE" readiness gate.
 * Extracted from `DealsKanbanView` so the stage stepper on the deal-detail
 * page and the inline stage dropdown in the table view can reuse the same
 * UX without re-implementing the warning-acknowledgement flow.
 */
export function DealActivationModal({
  dealTitle,
  checklist,
  pending,
  ackWarnings,
  onToggleAck,
  onCancel,
  onConfirm,
}: DealActivationModalProps) {
  const hasWarnings = checklist.some((item) => item.status === 'warn')
  const hasBlocks = checklist.some((item) => item.status === 'block')
  const confirmDisabled = pending || hasBlocks || (hasWarnings && !ackWarnings)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">Readiness Check: Move to Active</h3>
          <p className="text-sm text-gray-500 mt-1">{dealTitle}</p>
        </div>
        <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {checklist.map((item) => (
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
              <span className="mr-2">{item.status === 'pass' ? '✓' : item.status === 'warn' ? '⚠' : '✗'}</span>
              {item.message}
            </div>
          ))}

          {hasWarnings ? (
            <label className="flex items-start gap-2 text-sm text-gray-700 pt-2">
              <input
                type="checkbox"
                checked={ackWarnings}
                onChange={(e) => onToggleAck(e.target.checked)}
                className="mt-0.5"
              />
              I acknowledge all warnings and want to continue activation.
            </label>
          ) : null}
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? 'Activating...' : 'Confirm Move to Active'}
          </button>
        </div>
      </div>
    </div>
  )
}
