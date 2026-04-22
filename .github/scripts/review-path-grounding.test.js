// Regression tests for THE-87. Fixtures are built from:
//   - the real diff of PR #44 (globals.css + layout.tsx + an empty commit)
//   - the actual hallucinated review posted on PR #44
//     (https://github.com/bhavotelli/therum-platform/pull/44#issuecomment-4299413108)
//
// Run: node .github/scripts/review-path-grounding.test.js
//
// A passing run prints "✅ all path-grounding tests passed". Any failure
// exits non-zero with the offending expectation.

import {
  extractDiffPaths,
  extractFindingPaths,
  detectHallucinatedPaths,
  extractSection,
} from './review-path-grounding.js'

let failures = 0
function assert(cond, label) {
  if (cond) {
    console.log(`  ✔ ${label}`)
  } else {
    console.error(`  ✗ ${label}`)
    failures++
  }
}

// ---------------------------------------------------------------------------
// Fixture 1: PR #44 real diff header (shape only — we only need the
// `diff --git` lines for path extraction).
// ---------------------------------------------------------------------------
const pr44DiffHeaders = `diff --git a/src/app/globals.css b/src/app/globals.css
index abc..def 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -1 +1 @@
diff --git a/src/app/layout.tsx b/src/app/layout.tsx
index 111..222 100644
--- a/src/app/layout.tsx
+++ b/src/app/layout.tsx
@@ -1 +1 @@`

// ---------------------------------------------------------------------------
// Fixture 2: the hallucinated review body posted on PR #44. Note how the
// findings cite actions.ts, AddExpenseForm.tsx, NewDealForm.tsx, xero-sync.ts,
// sentry-filters.ts — NONE of which appear in the real diff.
// ---------------------------------------------------------------------------
const hallucinatedReview = `## 🔍 Claude PR Review

### What this PR does
Removes client-side validation from three forms and adds a z-index scale.

---

### 🔴 Blockers

**src/app/(agency)/agency/pipeline/[id]/actions.ts (lines 137-140 removed)**
**Issue:** Server-side validation for \`formData.amount > 0\` has been removed.
**Fix:** Restore validation in \`src/app/(agency)/agency/pipeline/[id]/actions.ts\`.

---

### 🟠 High Priority

**src/app/(agency)/agency/pipeline/[id]/AddExpenseForm.tsx (lines 26-31)**
**Issue:** Amount validation removed.

**src/app/(agency)/agency/pipeline/new/NewDealForm.tsx (lines 74-85)**
**Issue:** Milestone validation moved to toast-only feedback.

---

### 🟡 Medium Priority

**src/lib/sentry-filters.ts (lines 91-100)**
**Issue:** OAuth safe error codes reduced from 10 to 7.

**src/lib/xero-sync.ts (lines 249-270)**
**Issue:** Removed reconnect hint for 401 errors.

---

### ✅ What looks good

1. **Z-index scale in src/app/globals.css** — clear comment
2. **Toaster annotation in src/app/layout.tsx** — explains body-child requirement

---

### Verdict
🚫 **CHANGES REQUIRED**`

// ---------------------------------------------------------------------------
// Fixture 3: a clean, accurate review of PR #43 (single-line sidebar fix).
// This should produce zero hallucinated paths.
// ---------------------------------------------------------------------------
const pr43DiffHeaders = `diff --git a/src/components/layout/SidebarShell.tsx b/src/components/layout/SidebarShell.tsx
index a0669ac..2f244a1 100644`

const cleanReview = `## 🔍 Claude PR Review

### What this PR does
Single-line change to SidebarShell.tsx adjusting responsive padding.

---

### 🔴 Blockers
None found.

### 🟠 High Priority
None found.

### 🟡 Medium Priority

**src/components/layout/SidebarShell.tsx:40**
🟡 MEDIUM: Verify mobile layout handles fixed sidebar with unconditional padding.

---

### ✅ What looks good
1. Focused, single-purpose change.

---

### Verdict
✅ APPROVED WITH NOTES`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('extractDiffPaths')
const pr44Paths = extractDiffPaths(pr44DiffHeaders)
assert(pr44Paths.has('src/app/globals.css'), 'picks up globals.css')
assert(pr44Paths.has('src/app/layout.tsx'), 'picks up layout.tsx')
assert(pr44Paths.size === 2, `exactly 2 paths (got ${pr44Paths.size})`)

const pr43Paths = extractDiffPaths(pr43DiffHeaders)
assert(pr43Paths.has('src/components/layout/SidebarShell.tsx'), 'pr43: SidebarShell.tsx')
assert(pr43Paths.size === 1, `pr43: exactly 1 path (got ${pr43Paths.size})`)

console.log('extractSection')
const blockers = extractSection(hallucinatedReview, '🔴 Blockers')
assert(blockers.includes('actions.ts'), 'Blockers section contains actions.ts reference')
assert(!blockers.includes('What this PR does'), 'Blockers section does not bleed into earlier content')

const noBlockers = extractSection(cleanReview, '🔴 Blockers')
assert(/^none found/i.test(noBlockers.trim()), 'clean review has "None found." under Blockers')

console.log('extractFindingPaths')
const findingPaths = extractFindingPaths(hallucinatedReview)
assert(findingPaths.has('src/app/(agency)/agency/pipeline/[id]/actions.ts'), 'catches actions.ts under Blockers')
assert(findingPaths.has('src/app/(agency)/agency/pipeline/[id]/AddExpenseForm.tsx'), 'catches AddExpenseForm under High')
assert(findingPaths.has('src/app/(agency)/agency/pipeline/new/NewDealForm.tsx'), 'catches NewDealForm under High')
assert(findingPaths.has('src/lib/sentry-filters.ts'), 'catches sentry-filters under Medium')
assert(findingPaths.has('src/lib/xero-sync.ts'), 'catches xero-sync under Medium')
assert(!findingPaths.has('src/app/globals.css'), 'does NOT pick up globals.css (cited under ✅ What looks good, not a finding)')
assert(!findingPaths.has('src/app/layout.tsx'), 'does NOT pick up layout.tsx (cited under ✅ What looks good)')

console.log('detectHallucinatedPaths — hallucinated review against PR #44 diff')
const hallucinated = detectHallucinatedPaths(hallucinatedReview, pr44Paths)
assert(hallucinated.length >= 5, `finds ≥5 hallucinated paths (got ${hallucinated.length})`)
assert(hallucinated.includes('src/lib/sentry-filters.ts'), 'includes sentry-filters.ts')
assert(hallucinated.includes('src/lib/xero-sync.ts'), 'includes xero-sync.ts')
assert(!hallucinated.includes('src/app/globals.css'), 'does NOT flag globals.css (in diff)')

console.log('detectHallucinatedPaths — clean review against PR #43 diff')
const cleanHallucinated = detectHallucinatedPaths(cleanReview, pr43Paths)
assert(cleanHallucinated.length === 0, `clean review produces zero hallucinations (got ${cleanHallucinated.length}: ${cleanHallucinated.join(', ')})`)

console.log('')
if (failures === 0) {
  console.log('✅ all path-grounding tests passed')
} else {
  console.error(`❌ ${failures} assertion(s) failed`)
  process.exit(1)
}
