import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateSchemaManifest } from './generate-schema-manifest.js'

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

const message = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 2000,
  system: systemPrompt,
  messages: [{ role: 'user', content: userMessage }],
})

const review = message.content[0].type === 'text' ? message.content[0].text : ''

if (!review) {
  console.log('No review content returned — skipping')
  process.exit(0)
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
// Blocker detection — parse the Blockers section body, don't just substring
//
// Previous logic: `review.includes('### 🔴 Blockers') && !review.includes('None found.')`
// That was trivially wrong: "None found." anywhere in the review (even inside
// another section) would hide real blockers, and a review stating "no true
// blockers — downgrading to HIGH" would still fail CI because the Blockers
// section had content even though the model explicitly dismissed it.
//
// New logic: isolate the Blockers section, then honour explicit "none" /
// "downgrading" / "no true blockers" text within that section.
// ---------------------------------------------------------------------------
function extractSection(reviewText, heading) {
  const parts = reviewText.split(/^### /m)
  const section = parts.find((s) => s.startsWith(heading))
  if (!section) return ''
  return section.split('\n').slice(1).join('\n').trim()
}

function hasRealBlockers(reviewText) {
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

  // Section has content that isn't an explicit dismissal — treat as genuine.
  return body.length > 0
}

if (hasRealBlockers(review)) {
  console.error('🚫 Blockers found — failing CI')
  process.exit(1)
}

console.log('✅ No blockers found')
