'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type InlineStageBadgeProps = {
  dealId: string
  dealTitle: string
  currentStage: DealStage
  /** Tailwind classes for the badge's colour family — mirrors the rules
   *  already in DealsClientTable so the badge looks identical when collapsed. */
  badgeClassName: string
  /** Stage label text shown inside the badge. */
  label: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to update stage. Please try again.'
}

/**
 * Click-target replacement for the static stage badge in DealsClientTable.
 * Behaves as a button + menu when the deal is in a user-movable stage
 * (PIPELINE / NEGOTIATING / CONTRACTED); falls back to a plain badge once
 * the deal becomes ACTIVE+ (matches the server's `LOCKED_CURRENT_STAGES`
 * rule — the same code path the deal-detail stepper enforces).
 */
export function InlineStageBadge({
  dealId,
  dealTitle,
  currentStage,
  badgeClassName,
  label,
}: InlineStageBadgeProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [activationChecklist, setActivationChecklist] = useState<ReadinessItem[] | null>(null)
  const [ackWarnings, setAckWarnings] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const movable = isUserMovableFrom(currentStage)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function commitStage(target: DealStage, acknowledgedWarningIds?: string[]) {
    setPending(true)
    try {
      const result = await updateDealStage(dealId, target, { acknowledgedWarningIds })
      if (!result.success) throw new Error('Failed to update stage')
      toast.success(`Moved to ${STAGE_DISPLAY[target].shortLabel}`)
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function handleSelect(target: DealStage) {
    if (pending) return
    if (target === currentStage) {
      setOpen(false)
      return
    }
    if (!isUserMovableTo(target)) return

    const currentIdx = STAGE_ORDER.indexOf(currentStage)
    const targetIdx = STAGE_ORDER.indexOf(target)

    if (target === 'ACTIVE') {
      try {
        const checklist = await getDealActivationReadiness(dealId)
        setAckWarnings(false)
        setActivationChecklist(checklist)
        setOpen(false)
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
      return
    }

    if (targetIdx < currentIdx) {
      const fromLabel = STAGE_DISPLAY[currentStage].shortLabel
      const toLabel = STAGE_DISPLAY[target].shortLabel
      if (!window.confirm(`Move this deal back from ${fromLabel} to ${toLabel}?`)) return
    }

    await commitStage(target)
  }

  async function handleConfirmActivation() {
    if (!activationChecklist) return
    const warningItems = activationChecklist.filter((i) => i.status === 'warn')
    const blockItems = activationChecklist.filter((i) => i.status === 'block')
    if (blockItems.length > 0) return
    if (warningItems.length > 0 && !ackWarnings) return
    await commitStage('ACTIVE', warningItems.map((i) => i.id))
    setActivationChecklist(null)
    setAckWarnings(false)
  }

  // If the deal isn't movable, render the same static badge layout as before.
  if (!movable) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${badgeClassName}`}
        title="Stage is locked once the deal becomes Active"
      >
        {label}
      </span>
    )
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        disabled={pending}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${badgeClassName} hover:brightness-95 disabled:opacity-60`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <svg className="h-3 w-3 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute z-20 mt-1 left-0 min-w-[180px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-left"
        >
          {STAGE_ORDER.map((stage) => {
            const isCurrent = stage === currentStage
            const isLocked = SYSTEM_CONTROLLED_STAGE_SET.has(stage)
            const display = STAGE_DISPLAY[stage]
            const disabled = isCurrent || isLocked || pending
            return (
              <button
                key={stage}
                type="button"
                role="menuitem"
                onClick={() => {
                  if (disabled) return
                  void handleSelect(stage)
                }}
                disabled={disabled}
                className={[
                  'flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium',
                  disabled ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                <span>{display.shortLabel}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-70">
                  {isCurrent ? 'current' : isLocked ? 'system' : ''}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

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
    </div>
  )
}
