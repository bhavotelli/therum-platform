import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateSchemaManifest } from './generate-schema-manifest.js'
import {
  PATH_RE,
  extractSection,
  extractDiffPaths,
  detectHallucinatedPaths,
} from './review-path-grounding.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---------------------------------------------------------------------------
// Load guidelines
// ---------------------------------------------------------------------------
let guidelines = ''
try {
  guidelines = readFileSync(
    join(__dirname, '..', 'review-guidelines.md'),
    'utf8'
  )
  console.log('✅ Loaded review-guidelines.md')
} catch {
  console.warn('⚠️  review-guidelines.md not found — using base rules only')
}

// ---------------------------------------------------------------------------
// Generate current schema manifest from src/types/database.ts
//
// The guidelines.md used to hand-maintain a "Supabase Schema Reference" that
// went stale every time a migration landed — the reviewer would then flag
// any PR reading those columns as "missing schema change documentation." Now
// we generate the canonical column list per Row type at review time so the
// reviewer always sees the current state of main.
// ---------------------------------------------------------------------------
let schemaManifest = ''
try {
  const typesContent = readFileSync(
    join(repoRoot, 'src', 'types', 'database.ts'),
    'utf8'
  )
  schemaManifest = generateSchemaManifest(typesContent)
  console.log(`✅ Generated schema manifest (${schemaManifest.split('\n').length} tables)`)
} catch (e) {
  console.warn(`⚠️  Failed to generate schema manifest: ${e.message}`)
}

// ---------------------------------------------------------------------------
// Get diff
// ---------------------------------------------------------------------------
const diff = execSync(
  `git diff ${process.env.BASE_SHA}..${process.env.HEAD_SHA}`
).toString()

if (!diff.trim()) {
  console.log('No diff found — skipping review')
  process.exit(0)
}

const MAX_DIFF_CHARS = 80000
const truncated = diff.length > MAX_DIFF_CHARS
const diffToReview = truncated
  ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n[DIFF TRUNCATED]'
  : diff

// ---------------------------------------------------------------------------
// Fetch existing PR comments BEFORE we delete our previous review — we want
// to preserve the author's rebuttal context for the next reviewer pass so
// it doesn't re-raise items that have already been refuted with evidence.
// ---------------------------------------------------------------------------
const [owner, repo] = process.env.REPO.split('/')
const prNumber = parseInt(process.env.PR_NUMBER)
const ghHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
}

const listResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  { headers: ghHeaders }
)
const existingComments = await listResponse.json()

const priorClaudeReviews = existingComments.filter(
  (c) =>
    c.user.login === 'github-actions[bot]' &&
    c.body.includes('Claude PR Review')
)
const lastClaudeReview = priorClaudeReviews[priorClaudeReviews.length - 1] ?? null

// Any non-bot comment after the most recent prior review is treated as the
// author's pushback on that review. Truncate each to keep context compact.
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '\n… [truncated]' : str
}

// Cap at the 20 most recent replies — on a long-lived PR with hundreds of
// comments we'd otherwise blow the token budget. 20 is generous: a typical
// pushback thread is 1-5 replies.
const MAX_PRIOR_REPLIES = 20

const priorAuthorReplies = lastClaudeReview
  ? existingComments
      .filter(
        (c) =>
          c.user.login !== 'github-actions[bot]' &&
          new Date(c.created_at) > new Date(lastClaudeReview.created_at)
      )
      .slice(-MAX_PRIOR_REPLIES)
      .map((c) => ({
        author: c.user.login,
        createdAt: c.created_at,
        // 6000 preserves typical pushback plus a realistic migration-file
        // dump or git-output citation without truncating mid-evidence.
        body: truncate(c.body, 6000),
      }))
  : []

const priorReviewContext =
  lastClaudeReview && priorAuthorReplies.length > 0
    ? `
=== PRIOR REVIEW CONTEXT ===

An earlier review of this PR was posted (now replaced by this one). The PR author responded with pushback/clarifications. When re-reviewing, DO NOT re-raise items the author has explicitly rebutted with evidence (git output, migration file paths, code citations) unless you have genuinely new information from this diff.

PREVIOUS REVIEW (summary):
${truncate(lastClaudeReview.body, 6000)}

AUTHOR RESPONSES:
${priorAuthorReplies.map((r) => `[${r.author} @ ${r.createdAt}]\n${r.body}`).join('\n\n---\n\n')}
=== END PRIOR REVIEW CONTEXT ===
`
    : ''

if (priorReviewContext) {
  console.log(
    `📎 Including prior review + ${priorAuthorReplies.length} author reply/replies in context`
  )
}

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------
const systemPrompt = `You are a senior code reviewer for Therum Technologies — a UK B2B SaaS platform for talent agencies. Stack: Next.js, Supabase, Xero API, Stripe Connect. This is financial software. Mistakes have real monetary consequences.

Review the PR diff using the guidelines below. Severity levels: 🔴 BLOCKER, 🟠 HIGH, 🟡 MEDIUM, 🟢 SUGGESTION.

CRITICAL OPERATING RULES (read carefully — these override the guidelines when in conflict):

0. **Ground every finding in the diff.** Each Blocker / High / Medium / Suggestion MUST cite a file path that literally appears in this PR as a \`diff --git a/<path>\` header. Before you write any finding, confirm its path is in the diff. Do NOT flag files the PR does not touch — even if you "remember" typical issues from past reviews in this codebase (financial validation in actions.ts, Xero sync, Sentry filters, etc.). Short diffs produce short reviews. Comment-only or CSS-only diffs frequently have zero findings, and "None found" is the correct answer in that case. Never pad a review with findings invented from training-memory patterns.

1. You only see the PR diff, NOT the full codebase. A column, function, or pattern that doesn't appear in the diff may still exist on main. Before flagging a referenced column/table as "missing schema change documentation," check the CURRENT SCHEMA MANIFEST below — it lists every column on every table as of the base branch.

2. The PR diff shows what this PR CHANGES. Do not flag existing patterns (e.g. existing numeric financial columns, existing service-role usage) as introduced by this PR unless the diff actually introduces them.

3. If you see \`+\` lines in the diff adding a schema change (\`ALTER TABLE\`, \`CREATE TABLE\`, \`CREATE POLICY\`), check whether the PR description includes the SQL block. If not, that's a legitimate blocker. If the diff contains no \`.sql\` changes, schema-change rules don't apply.

4. If prior review context is provided below, the PR author may have already rebutted earlier findings with evidence. Respect rebuttals backed by git commands, migration file paths, or code citations — don't re-raise the same items unless the diff introduces something new.

--- CURRENT SCHEMA MANIFEST (generated from src/types/database.ts at review time) ---
${schemaManifest || '(not available — review-pr.js could not load the types file)'}
--- END SCHEMA MANIFEST ---

--- REVIEW GUIDELINES START ---
${guidelines}
--- REVIEW GUIDELINES END ---

RESPOND IN THIS EXACT FORMAT:

## 🔍 Claude PR Review

### What this PR does
[2-3 sentence summary]

---

### 🔴 Blockers
[Each blocker: file + line, issue, why it matters, how to fix. If none: "None found."]

### 🟠 High Priority
[Each issue: file + line, issue, fix. If none: "None found."]

### 🟡 Medium Priority
[If none: omit]

### 🟢 Suggestions
[If none: omit]

---

### ✅ What looks good
[Max 3 specific points]

---

### Verdict
[✅ APPROVED · ⚠️ APPROVED WITH NOTES · 🚫 CHANGES REQUIRED]
[One sentence]

---
*Reviewed by Claude · ${new Date().toISOString().split('T')[0]}*`

const userMessage = `Please review this PR diff:

\`\`\`diff
${diffToReview}
\`\`\`
${priorReviewContext}`

// ---------------------------------------------------------------------------
// Path grounding — guard against the reviewer fabricating findings about
// files the PR does not touch (THE-87). Helpers live in
// review-path-grounding.js so they can be regression-tested without pulling
// in the Anthropic SDK / GitHub API side effects.
//
// If a first-pass finding references a path that isn't in the diff, that
// finding was invented from training-memory patterns rather than from what
// was changed. On first detection we retry with a stricter message naming
// the fabricated paths; if the retry is still hallucinated we prepend a
// warning banner and refuse to fail CI on all-fabricated blocker sections.
// ---------------------------------------------------------------------------
const diffPaths = extractDiffPaths(diff)
console.log(`📁 Diff touches ${diffPaths.size} path(s)`)

async function generateReview(messages) {
  const m = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  })
  return m.content[0].type === 'text' ? m.content[0].text : ''
}

let review = await generateReview([{ role: 'user', content: userMessage }])

if (!review) {
  console.log('No review content returned — skipping')
  process.exit(0)
}

let hallucinated = detectHallucinatedPaths(review, diffPaths)

if (hallucinated.length > 0) {
  console.warn(
    `⚠️  First-pass review cited ${hallucinated.length} path(s) not in the diff: ${hallucinated.join(', ')} — retrying with stricter grounding.`
  )
  const retryUserMessage = `Your previous review cited these file paths in its findings, but NONE of them appear in this PR's diff:

${hallucinated.map((p) => `- ${p}`).join('\n')}

Those findings were fabricated from training-memory patterns, not from the actual diff. The real diff touches only these paths:

${[...diffPaths].map((p) => `- ${p}`).join('\n')}

Produce a new review from scratch. Every Blocker / High / Medium / Suggestion must cite one of the paths above (or a line within one). If the real diff has nothing substantive to flag, write "None found" in each findings section — a short review is the correct answer for a short diff.

Review this diff:

\`\`\`diff
${diffToReview}
\`\`\`
${priorReviewContext}`
  const retryReview = await generateReview([
    { role: 'user', content: userMessage },
    { role: 'assistant', content: review },
    { role: 'user', content: retryUserMessage },
  ])
  if (retryReview) {
    const retryHallucinated = detectHallucinatedPaths(retryReview, diffPaths)
    if (retryHallucinated.length < hallucinated.length) {
      console.log(
        `✅ Retry reduced hallucinated paths from ${hallucinated.length} to ${retryHallucinated.length}`
      )
      review = retryReview
      hallucinated = retryHallucinated
    } else {
      console.warn(
        `⚠️  Retry did not improve (${retryHallucinated.length} hallucinated paths) — keeping original with banner`
      )
    }
  }
}

if (hallucinated.length > 0) {
  const banner = `> ⚠️ **Automated path-grounding check flagged this review.** The findings below cite ${hallucinated.length} file path(s) that are NOT in this PR's diff: ${hallucinated.map((p) => `\`${p}\``).join(', ')}. Treat findings referencing those paths as likely fabrications and check the real diff (\`gh pr diff ${prNumber} --name-only\`) before acting.\n\n---\n\n`
  review = banner + review
}

// ---------------------------------------------------------------------------
// Delete the prior Claude review (if any) and post the new one
// ---------------------------------------------------------------------------
if (lastClaudeReview) {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/comments/${lastClaudeReview.id}`,
    { method: 'DELETE', headers: ghHeaders }
  )
}

const postResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  {
    method: 'POST',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: review }),
  }
)

if (postResponse.ok) {
  console.log('✅ Claude review posted')
} else {
  console.error('Failed to post review')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Blocker detection — parse the Blockers section body, don't just substring.
//
// Previous logic: `review.includes('### 🔴 Blockers') && !review.includes('None found.')`
// That was trivially wrong: "None found." anywhere in the review (even inside
// another section) would hide real blockers, and a review stating "no true
// blockers — downgrading to HIGH" would still fail CI because the Blockers
// section had content even though the model explicitly dismissed it.
//
// Current logic: isolate the Blockers section, then honour explicit "none" /
// "downgrading" / "no true blockers" text within that section. Additionally
// (THE-87) treat all-fabricated-path blocker sections as "no real blockers"
// — the cited files aren't in the diff, so the finding can't be acted on.
// (Helpers extractSection + PATH_RE imported from review-path-grounding.js.)
// ---------------------------------------------------------------------------
function hasRealBlockers(reviewText, diffPathsForCheck) {
  const body = extractSection(reviewText, '🔴 Blockers')
  if (!body) return false

  // The first non-blank line is the dismissal signal if it exists. Anything
  // following (explanatory text, trailing dashes, structured content) still
  // counts as "none found" provided the opening line says so.
  const firstLine = body.split('\n').find((l) => l.trim().length > 0) ?? ''

  if (/^\s*none(\s+found)?[.:,\-—\s]/i.test(firstLine + ' ')) return false
  if (/^\s*no\s+(true\s+|real\s+)?blockers/i.test(firstLine)) return false

  // Full-body dismissal patterns — catch mid-section "downgrading" text where
  // the model explicitly recants the blocker.
  if (/no true blockers|no blockers found|no real blockers/i.test(body)) return false
  if (/downgrading to (🟠|high|medium|🟡)/i.test(body)) return false
  if (/verdict adjustment[^.]*no (true )?blockers/i.test(body)) return false

  // Path grounding: if the Blockers section cites file paths, at least one
  // must be a path in the actual diff. Sections citing only fabricated paths
  // are hallucinations and should not fail CI.
  if (diffPathsForCheck) {
    const cited = new Set([...body.matchAll(PATH_RE)].map((m) => m[1]))
    if (cited.size > 0) {
      const real = [...cited].filter((p) => diffPathsForCheck.has(p))
      if (real.length === 0) {
        console.warn(
          `⚠️  Blockers section cited only fabricated paths (${[...cited].join(', ')}) — not failing CI.`
        )
        return false
      }
    }
  }

  // Section has content that isn't an explicit dismissal — treat as genuine.
  return body.length > 0
}

if (hasRealBlockers(review, diffPaths)) {
  console.error('🚫 Blockers found — failing CI')
  process.exit(1)
}

console.log('✅ No blockers found')
