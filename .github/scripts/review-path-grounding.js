// Path-grounding helpers for the Claude PR review workflow (THE-87).
//
// Extracted from review-pr.js so the pure string-processing logic can be
// exercised without the Anthropic SDK + GitHub API side effects in the
// review script. See review-path-grounding.test.js for fixtures built from
// real hallucinated reviews observed on PRs #43 and #44.

export const FINDING_SECTIONS = [
  '🔴 Blockers',
  '🟠 High Priority',
  '🟡 Medium Priority',
  '🟢 Suggestions',
]

// Full-path references rooted at a recognised top-level directory. Narrow
// on purpose — bare filenames like `AddExpenseForm.tsx` also appear in
// legitimate prose, and matching them would produce false positives on
// reviews that correctly cross-reference shared patterns.
export const PATH_RE =
  /\b((?:src|supabase|scripts|tests|public|\.github|app|components|lib)\/[\w\-./()\[\]]*\.(?:tsx?|jsx?|mjs|css|sql|md|ya?ml|json))\b/g

export function extractSection(reviewText, heading) {
  const parts = reviewText.split(/^### /m)
  const section = parts.find((s) => s.startsWith(heading))
  if (!section) return ''
  return section.split('\n').slice(1).join('\n').trim()
}

export function extractDiffPaths(diffText) {
  const paths = new Set()
  for (const m of diffText.matchAll(/^diff --git a\/(\S+) b\/(\S+)/gm)) {
    paths.add(m[1])
    paths.add(m[2])
  }
  return paths
}

export function extractFindingPaths(reviewText) {
  const paths = new Set()
  for (const heading of FINDING_SECTIONS) {
    const body = extractSection(reviewText, heading)
    if (!body) continue
    for (const m of body.matchAll(PATH_RE)) paths.add(m[1])
  }
  return paths
}

export function detectHallucinatedPaths(reviewText, diffPaths) {
  const cited = extractFindingPaths(reviewText)
  return [...cited].filter((p) => !diffPaths.has(p))
}
