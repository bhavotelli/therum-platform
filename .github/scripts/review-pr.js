import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

let guidelines = ''
try {
  guidelines = readFileSync(
    join(__dirname, '..', 'review-guidelines.md'),
    'utf8'
  )
  console.log('✅ Loaded review-guidelines.md')
} catch (e) {
  console.warn('⚠️  review-guidelines.md not found — using base rules only')
}

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

const systemPrompt = `You are a senior code reviewer for Therum Technologies — a UK B2B SaaS platform for talent agencies. Stack: Next.js, Supabase, Xero API, Stripe Connect. This is financial software. Mistakes have real monetary consequences.

Review the PR diff using the guidelines below. Severity levels: 🔴 BLOCKER, 🟠 HIGH, 🟡 MEDIUM, 🟢 SUGGESTION.

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

const message = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 2000,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: `Please review this PR diff:\n\n\`\`\`diff\n${diffToReview}\n\`\`\``,
    },
  ],
})

const review = message.content[0].type === 'text' ? message.content[0].text : ''

if (!review) {
  console.log('No review content returned — skipping')
  process.exit(0)
}

const [owner, repo] = process.env.REPO.split('/')
const prNumber = parseInt(process.env.PR_NUMBER)

const listResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  }
)

const comments = await listResponse.json()
const existing = comments.find(
  (c) => c.user.login === 'github-actions[bot]' && c.body.includes('Claude PR Review')
)

if (existing) {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existing.id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )
}

const postResponse = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: review }),
  }
)

if (postResponse.ok) {
  console.log('✅ Claude review posted')
} else {
  console.error('Failed to post review')
  process.exit(1)
}

const hasBlockers = review.includes('### 🔴 Blockers') && !review.includes('None found.')

if (hasBlockers) {
  console.error('🚫 Blockers found — failing CI')
  process.exit(1)
}

console.log('✅ No blockers found')
