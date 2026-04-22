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
