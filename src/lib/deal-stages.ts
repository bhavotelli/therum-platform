import type { DealStage } from '@/types/database'

/**
 * Canonical pipeline-stage order. Source of truth for both the server's
 * `assertValidStageTransition` (pipeline/actions.ts) and the client-side
 * adjacency checks used by the kanban drop logic and the deal-edit form's
 * stage dropdown.
 *
 * Kept in a shared module rather than duplicated per consumer so adding
 * or reordering a stage is a single-file change.
 */
export const STAGE_ORDER: readonly DealStage[] = [
  'PIPELINE',
  'NEGOTIATING',
  'CONTRACTED',
  'ACTIVE',
  'IN_BILLING',
  'COMPLETED',
] as const

/**
 * Stages a deal can be in *before* it has been activated. While the deal
 * remains in one of these, agents can freely move between them in either
 * direction; once a deal enters ACTIVE the stage becomes system-controlled.
 */
export const PRE_ACTIVE_STAGE_SET: ReadonlySet<DealStage> = new Set([
  'PIPELINE',
  'NEGOTIATING',
  'CONTRACTED',
])

/**
 * Stages that are advanced automatically by the invoicing/payment pipeline
 * rather than by user action. Mirrors `SYSTEM_CONTROLLED_STAGES` in
 * `pipeline/actions.ts` — kept here so client code can render these
 * differently (lock icon, non-clickable) without re-importing server modules.
 */
export const SYSTEM_CONTROLLED_STAGE_SET: ReadonlySet<DealStage> = new Set([
  'IN_BILLING',
  'COMPLETED',
])

/**
 * Display metadata per stage — short label (used in stage badges + Kanban
 * column headers) and an accent colour family. The colour token names map to
 * the existing per-stage styling used in `DealsClientTable` / `DealsKanbanView`.
 */
export type StageDisplay = {
  id: DealStage
  shortLabel: string
  accent: 'gray' | 'indigo' | 'amber' | 'blue' | 'teal' | 'emerald'
}

export const STAGE_DISPLAY: Record<DealStage, StageDisplay> = {
  PIPELINE: { id: 'PIPELINE', shortLabel: 'Prospect', accent: 'gray' },
  NEGOTIATING: { id: 'NEGOTIATING', shortLabel: 'Negotiating', accent: 'indigo' },
  CONTRACTED: { id: 'CONTRACTED', shortLabel: 'Contracting', accent: 'amber' },
  ACTIVE: { id: 'ACTIVE', shortLabel: 'Active', accent: 'blue' },
  IN_BILLING: { id: 'IN_BILLING', shortLabel: 'In Billing', accent: 'teal' },
  COMPLETED: { id: 'COMPLETED', shortLabel: 'Completed', accent: 'emerald' },
}

/**
 * Stages an agent can manually move *from*. Once a deal reaches ACTIVE the
 * stage transitions to system-driven (milestone completion / payout
 * settlement), so the stepper, Kanban drag handles, and table dropdown all
 * disable user changes in that range.
 */
export function isUserMovableFrom(stage: DealStage): boolean {
  return PRE_ACTIVE_STAGE_SET.has(stage)
}

/**
 * Stages an agent can manually move *to* — anything except the
 * system-controlled tail. The forward step into ACTIVE is additionally
 * gated by `getDealActivationReadiness`.
 */
export function isUserMovableTo(stage: DealStage): boolean {
  return !SYSTEM_CONTROLLED_STAGE_SET.has(stage)
}
