/**
 * Platform wordmark. Single source of truth — every surface that needs the
 * logo imports this. That means changes here (like the Beta badge added
 * per THE-82, or the collapsed shorthand per THE-35) propagate to every
 * sidebar, auth page, and print header automatically with no per-consumer
 * wiring.
 *
 * `className` is applied to the outer wrapper so font-size, colour, and
 * drop-shadow cascade to both the "therum" wordmark and the Beta badge,
 * keeping them visually linked at any size.
 *
 * The badge itself uses `em`-relative sizing so it scales proportionally
 * with the wordmark — at text-2xl (sidebar) it reads ~10px, at text-5xl
 * (login) it reads ~20px. That keeps it legible on small surfaces and
 * subordinate on large ones.
 *
 * When `collapsed` is true (used by sidebars in their narrow state) the
 * wordmark shrinks to just "t" — same font, same colour, no badge. The
 * prop lives here rather than as a hardcoded span in each sidebar so a
 * future logo-mark upgrade (SVG icon, monogram) only changes one file,
 * and the collapsed "t" inherits any font/weight/colour tweaks made to
 * the expanded wordmark.
 */
export function Logo({
  className = "",
  showBeta = true,
  collapsed = false,
}: {
  className?: string
  showBeta?: boolean
  collapsed?: boolean
}) {
  // Collapsed: single letter, no badge. Beta wouldn't fit legibly in a
  // 16px-wide sidebar slot and would be a decorative distraction anyway.
  if (collapsed) {
    return (
      <span className={`font-logo font-bold tracking-tight lowercase ${className}`}>
        t
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-[0.35em] ${className}`}>
      <span className="font-logo font-bold tracking-tight lowercase">
        therum
      </span>
      {showBeta && (
        <span
          className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-[0.5em] py-[0.1em] text-[0.32em] font-bold uppercase tracking-[0.2em] text-indigo-700 leading-none"
        >
          Beta
        </span>
      )}
    </span>
  )
}
