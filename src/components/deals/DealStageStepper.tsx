'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'

import { getDealActivationReadiness, updateDealStage } from '@/app/(agency)/agency/pipeline/actions'
import { DealActivationModal, type ReadinessItem } from '@/components/deals/DealActivationModal'
import {
  STAGE_DISPLAY,
  STAGE_ORDER,
  SYSTEM_CONTROLLED_STAGE_SET,
  isUserMovableFrom,
  isUserMovableTo,
} from '@/lib/deal-stages'
import type { DealStage } from '@/types/database'

type DealStageStepperProps = {
  dealId: string
  dealTitle: string
  currentStage: DealStage
}

/**
 * Visual state of a single chip in the stepper. Mapped from the deal's
 * current stage + the chip's own position:
 *
 * - `completed`: chip's stage sits before currentStage in STAGE_ORDER
 * - `current`: chip is the deal's current stage
 * - `available`: chip is a future stage AND the deal is still user-movable
 *   (i.e. currently in PIPELINE/NEGOTIATING/CONTRACTED) AND the chip itself
 *   isn't system-controlled
 * - `locked`: chip is system-controlled (IN_BILLING / COMPLETED) when not
 *   currentStage — rendered with a lock icon and not clickable
 * - `inert`: chip is reachable in principle but not from the current stage
 *   (e.g. deal is ACTIVE — all chips other than current become inert)
 */
type ChipState = 'completed' | 'current' | 'available' | 'locked' | 'inert'

const ACCENT_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', ring: 'ring-gray-300' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', ring: 'ring-indigo-300' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', ring: 'ring-amber-300' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', ring: 'ring-blue-300' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', ring: 'ring-teal-300' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'ring-emerald-300' },
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to update stage. Please try again.'
}

export function DealStageStepper({ dealId, dealTitle, currentStage }: DealStageStepperProps) {
  const [pending, setPending] = useState(false)
  const [activationChecklist, setActivationChecklist] = useState<ReadinessItem[] | null>(null)
  const [ackWarnings, setAckWarnings] = useState(false)

  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  const dealIsUserMovable = isUserMovableFrom(currentStage)

  function chipState(stage: DealStage): ChipState {
    if (stage === currentStage) return 'current'
    const idx = STAGE_ORDER.indexOf(stage)
    if (SYSTEM_CONTROLLED_STAGE_SET.has(stage)) return 'locked'
    if (!dealIsUserMovable) return 'inert'
    if (idx < currentIdx) return 'available' // backward (pre-ACTIVE → earlier pre-ACTIVE)
    return 'available' // forward (pre-ACTIVE → ACTIVE)
  }

  async function commitStage(target: DealStage, acknowledgedWarningIds?: string[]) {
    setPending(true)
    try {
      const result = await updateDealStage(dealId, target, { acknowledgedWarningIds })
      if (!result.success) throw new Error('Failed to update stage')
      const label = STAGE_DISPLAY[target].shortLabel
      toast.success(`Moved to ${label}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function handleChipClick(target: DealStage) {
    if (pending) return
    if (target === currentStage) return
    if (!isUserMovableFrom(currentStage)) return
    if (!isUserMovableTo(target)) return

    const targetIdx = STAGE_ORDER.indexOf(target)

    // Forward to ACTIVE goes through the readiness checklist.
    if (target === 'ACTIVE') {
      try {
        const checklist = await getDealActivationReadiness(dealId)
        setAckWarnings(false)
        setActivationChecklist(checklist)
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
      return
    }

    // Backward move within pre-ACTIVE — light confirm. (Milestones can't be
    // in-progress yet because manual movement out of ACTIVE is blocked, but
    // a backward move still changes pipeline reporting so we double-check.)
    if (targetIdx < currentIdx) {
      const fromLabel = STAGE_DISPLAY[currentStage].shortLabel
      const toLabel = STAGE_DISPLAY[target].shortLabel
      if (!window.confirm(`Move this deal back from ${fromLabel} to ${toLabel}?`)) {
        return
      }
    }

    await commitStage(target)
  }

  async function handleConfirmActivation() {
    if (!activationChecklist) return
    const warningItems = activationChecklist.filter((i) => i.status === 'warn')
    const blockItems = activationChecklist.filter((i) => i.status === 'block')
    if (blockItems.length > 0) return
    if (warningItems.length > 0 && !ackWarnings) return

    await commitStage(
      'ACTIVE',
      warningItems.map((i) => i.id),
    )
    setActivationChecklist(null)
    setAckWarnings(false)
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STAGE_ORDER.map((stage, idx) => {
            const state = chipState(stage)
            const display = STAGE_DISPLAY[stage]
            const accent = ACCENT_CLASSES[display.accent]
            const isClickable = state === 'available' && !pending
            const isCurrent = state === 'current'

            return (
              <React.Fragment key={stage}>
                <button
                  type="button"
                  onClick={() => handleChipClick(stage)}
                  disabled={!isClickable}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap',
                    isCurrent
                      ? `${accent.bg} ${accent.text} ring-2 ${accent.ring} ring-offset-1`
                      : state === 'completed'
                        ? `${accent.bg} ${accent.text} opacity-70`
                        : state === 'available'
                          ? `border ${accent.border} bg-white ${accent.text} hover:${accent.bg} cursor-pointer`
                          : state === 'locked'
                            ? 'border border-dashed border-gray-300 bg-white text-gray-400 cursor-not-allowed'
                            : 'border border-gray-200 bg-white text-gray-400 cursor-not-allowed',
                  ].join(' ')}
                  title={
                    state === 'locked'
                      ? `${display.shortLabel} is set automatically when the deal reaches this point`
                      : state === 'inert'
                        ? `Stage is locked once the deal becomes Active`
                        : undefined
                  }
                >
                  <span
                    className={[
                      'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                      isCurrent
                        ? 'bg-white/70'
                        : state === 'completed'
                          ? 'bg-white/60'
                          : 'bg-gray-100',
                    ].join(' ')}
                  >
                    {state === 'locked' ? '🔒' : idx + 1}
                  </span>
                  {display.shortLabel}
                </button>
                {idx < STAGE_ORDER.length - 1 ? (
                  <span className="h-px w-3 bg-gray-200 flex-shrink-0" aria-hidden="true" />
                ) : null}
              </React.Fragment>
            )
          })}
        </div>
        {!dealIsUserMovable ? (
          <p className="mt-3 text-[11px] text-gray-500">
            Stage is locked once the deal becomes Active — further movement is driven by milestone completion and payout settlement.
          </p>
        ) : null}
      </div>

      {activationChecklist ? (
        <DealActivationModal
          dealTitle={dealTitle}
          checklist={activationChecklist}
          pending={pending}
          ackWarnings={ackWarnings}
          onToggleAck={setAckWarnings}
          onCancel={() => {
            setActivationChecklist(null)
            setAckWarnings(false)
          }}
          onConfirm={handleConfirmActivation}
        />
      ) : null}
    </>
  )
}
