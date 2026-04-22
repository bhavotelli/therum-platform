/**
 * Platform wordmark. Single source of truth — every surface that needs the
 * logo imports this. That means changes here (like the Beta badge added
 * per THE-82) propagate to every sidebar, auth page, and print header
 * automatically with no per-consumer wiring.
 *
 * `className` is applied to the outer wrapper so font-size, colour, and
 * drop-shadow cascade to both the "therum" wordmark and the Beta badge,
 * keeping them visually linked at any size.
 *
 * The badge itself uses `em`-relative sizing so it scales proportionally
 * with the wordmark — at text-2xl (sidebar) it reads ~10px, at text-5xl
 * (login) it reads ~20px. That keeps it legible on small surfaces and
 * subordinate on large ones.
 */
export function Logo({
  className = "",
  showBeta = true,
}: {
  className?: string
  showBeta?: boolean
}) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] ${className}`}>
      <span className="font-logo font-bold tracking-tight lowercase">
        therum
      </span>
      {showBeta && (
        <span
          aria-label="Beta release"
          className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-[0.5em] py-[0.1em] text-[0.32em] font-bold uppercase tracking-[0.2em] text-indigo-700 leading-none"
        >
          Beta
        </span>
      )}
    </span>
  )
}
