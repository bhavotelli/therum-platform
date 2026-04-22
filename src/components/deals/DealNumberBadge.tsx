/**
 * Small monospace pill for rendering a Deal.dealNumber (e.g. `NKE-0042`).
 *
 * Returns null when no deal number has been assigned yet — this happens for
 * deals created before the agency's dealNumberPrefix was configured. The
 * `assign_deal_number` DB trigger leaves `dealNumber` NULL in that case; those
 * legacy deals still identify themselves via title/client/talent, so we just
 * omit the badge rather than showing an "—" placeholder everywhere.
 *
 * Variants:
 *  - `default` (compact neutral): general inline use next to a deal title.
 *  - `emphasis` (larger, indigo): deal detail header — where the deal number
 *    is the primary human-friendly identifier.
 */
export function DealNumberBadge({
  dealNumber,
  variant = 'default',
  className = '',
}: {
  dealNumber: string | null | undefined
  variant?: 'default' | 'emphasis'
  className?: string
}) {
  if (!dealNumber) return null

  const ariaLabel = `Deal number ${dealNumber}`

  if (variant === 'emphasis') {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-mono font-bold tracking-tight text-indigo-700 ${className}`}
        title="Deal number"
        aria-label={ariaLabel}
      >
        {dealNumber}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight text-gray-600 ${className}`}
      title="Deal number"
      aria-label={ariaLabel}
    >
      {dealNumber}
    </span>
  )
}
