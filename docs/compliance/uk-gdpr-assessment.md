# UK GDPR pre-launch assessment

**Status:** Draft — needs legal review on policy-language sections and sign-off on the action checklist before any real-user onboarding.
**Author:** Bhav
**Ticket:** [THE-83](https://linear.app/therum/issue/THE-83)
**Date:** 2026-04-22

---

## 0. TL;DR

Therum is not yet ready to onboard real user data under UK GDPR. The
technical foundation is decent (RLS schema is built, audit logging
exists, service role is sandboxed to server-side code, encryption in
transit is enforced by Supabase/Vercel) but the **legal and
operational** side is entirely absent — no Privacy Policy published,
no DPAs signed with sub-processors, no data-subject-request process,
no retention policy, no ICO registration.

**Already in place:**

- **Privacy Policy** published at https://therum.io/privacy-policy
  (drafted by SeedLegals). Assessment below takes the live policy as
  given — remaining work is making sure our implementation matches
  what the policy promises.

**Critical blockers for launch** (legal/operational, not code):

1. **Privacy Policy ↔ implementation audit.** A templated policy can
   make commitments we haven't built for yet (30-day SAR response,
   specific sub-processor names, retention periods). Needs a
   side-by-side comparison before onboarding real users — see §11.
2. Signed DPAs on file with every named sub-processor below.
3. ICO registration completed and fee paid (Therum is almost certainly
   a "section 137" processor and needs to be registered).
4. A documented data-subject-request process that can meet the 30-day
   statutory deadline.
5. An incident-response runbook that can hit the 72-hour ICO
   notification window.

**Non-blockers (but tracked):** retention periods for each data
category, breach-drill exercise, DPIA if processing risk profile
changes, DPO appointment if scale demands it.

Estimated effort to close the blockers: **1-2 weeks of focused work**,
mostly non-code (policy audit, vendor admin, ICO forms). Code changes
are minor — a data-export endpoint and a data-deletion flow.

**Tracks can run in parallel:**

- **Legal/ops track** (policy revision, DPA signing, ICO registration,
  breach runbook drafting) runs alongside normal dev work — doesn't
  block feature delivery.
- **Eng track** (SAR endpoint, erasure flow, MFA enforcement,
  `User.passwordHash` drop) competes with feature work — sprint-plan
  accordingly.

---

## 1. Controller vs processor — Therum's dual role

This matters because the obligations differ, and Therum wears both
hats depending on whose data we're talking about.

### 1.1 Therum as **processor**

For **agency-owned data** — clients, client contacts, talent, deals,
invoices — the agency is the **controller**. They collected the data,
decided why, and Therum stores and processes it on their behalf.

Obligations as processor:

- Signed **DPA with each customer agency** before they onboard real data.
- Only process data per the agency's instructions (the product's
  normal operation counts as instruction).
- Notify the agency without undue delay if a breach affects their data.
- Return or delete data on contract termination.

### 1.2 Therum as **controller**

For **agency-staff user accounts** (the login users — `agent@...`,
`finance@...`) and any data Therum collects for its own purposes
(Sentry error logs with user IDs, audit logs showing who did what),
Therum is the **controller**.

Obligations as controller:

- Publish a Privacy Policy covering this processing.
- Collect lawful basis — for staff accounts this is usually "contract"
  (they need the account to do their job) or "legitimate interest."
- Fulfil data subject rights directly.

### 1.3 Why the distinction matters operationally

- A Privacy Policy on the Therum website needs two sections: one for
  agency staff users (where Therum is controller), one for data
  subjects whose data the platform holds (where Therum is processor,
  and the agency's own Privacy Policy is the governing document).
- Data-subject requests from a client's end customer don't go to
  Therum — they go to the agency, who may ask Therum to produce the
  data. Build the data-export tooling accordingly.

---

## 2. Data inventory

Derived from `src/types/database.ts` (Row types) and third-party
integrations. **Personal data** highlighted; non-personal is listed
for completeness but doesn't need the same treatment.

### 2.1 Personal data stored in the app DB

| Table | Personal-data fields | Who's the data subject | Sensitivity |
|---|---|---|---|
| `User` | `email`, `name`, `authUserId`, `lastLoginAt`, `inviteToken`, `passwordHash` (legacy; see note) | Agency staff (agent, finance, admin), talent | Medium — auth credentials |
| `Client` | — (no direct personal data; company name in `name`) | n/a | — |
| `ClientContact` | `name`, `email`, `phone`, `notes` | Client-side individuals | Medium |
| `Talent` | `name`, `email`, `companyName`, `companyRegNumber`, `registeredAddress`, `vatNumber`, `xeroContactId`, `stripeAccountId` | Talent (often high-profile individuals) | High — reputational + financial |
| `Deal`, `Milestone` | `notes`, `description` (free text — could incidentally contain PII) | Talent + clients | Low-medium |
| `InvoiceTriplet` | `recipientContactName`, `recipientContactEmail`, `invoiceAddress` | Client-side | Medium |
| `ChaseNote` | `contactedName`, `contactedEmail`, `note` (free-text chase log) | Client-side | Medium |
| `DealExpense` | `supplierRef`, `notes`, `receiptUrl` | Suppliers, possibly named employees | Low-medium |
| `AdminAuditLog` | `actorUserId`, `metadata` (can contain deal/user refs) | Staff users | Medium (user-action history) |
| `ImpersonationSession` | `adminUserId`, `agencyId`, session timestamps | Super-admin users | Medium |
| `PreviewLog` | `previewedBy`, `talentId` | Staff + talent | Low |
| `Session`, `ResetToken` | `userId`, `token`, `expiresAt` | Any user | Auth — high |

**Notes:**

- `User.passwordHash` is legacy (since the Supabase Auth migration in
  THE-65, passwords live in Supabase Auth, not the app DB). **This
  column is pre-launch blocker-scope** — see §10.2 — not a follow-up.
  A dangling password-hash column in a financial SaaS is an attack
  surface that should be closed before real-user onboarding.
- `Talent.registeredAddress` is currently `TEXT` — free-form, no PII
  redaction. Needs careful handling for right-to-erasure.
- Free-text `notes` fields across Deal / Milestone / ClientContact /
  ChaseNote are the highest-risk incidental-PII surface. Can't prevent
  a user typing "John gave me his home number 0207..." into a note.

### 2.2 Authentication data (managed by Supabase)

Supabase Auth holds the **hashed passwords**, session tokens, MFA
state (if enabled), and email-confirmation flags. Therum's DB stores
`authUserId` as the FK. Retention there is governed by Supabase's own
policies — see §6.

### 2.3 Data shared with sub-processors

- **Xero** — when an invoice is pushed: client contact details (name,
  email, address), invoice line items, amounts. Talent contact info on
  the self-billed invoice (SBI/COM). Xero is a **joint controller /
  sub-processor** relationship depending on interpretation.
- **Stripe** — currently no real transfers execute (beta note in
  `/finance/payouts` confirms this). Future: talent name, email,
  stripeAccountId, transfer amounts.
- **Sentry** — user IDs, email addresses via `user` context, any PII
  incidentally captured in error messages/stack traces. Redaction is
  configured in `instrumentation.ts` / axios redaction logic
  ([THE-54](https://linear.app/therum/issue/THE-54),
  [THE-64](https://linear.app/therum/issue/THE-64)) but hasn't been
  validated against real production samples.
- **Vercel** — IP addresses in access logs, hostnames, user agents.
- **Supabase** — everything in the DB + auth state.

---

## 3. Sub-processor inventory + DPA status

| Sub-processor | Role | DPA signed? | Notes |
|---|---|---|---|
| Supabase | DB + Auth + Storage | **Not confirmed — ACTION** | Supabase's standard DPA is available on their Trust page; needs executing via their self-serve form |
| Vercel | Hosting + logs | **Not confirmed — ACTION** | Vercel has a standard DPA; their Pro/Enterprise self-serve form covers it |
| Sentry | Error tracking | **Not confirmed — ACTION** | Sentry has a DPA; sign before any production rollout |
| Stripe | Payment/payout infrastructure | **Not confirmed — ACTION** | DPA is part of their standard terms; becomes required when the first real payout runs |
| Xero | Accounting | **Unusual — read this** | Xero's legal framing positions them as a **joint controller** with the customer, not a processor. Needs explicit legal review — does Therum (as processor for its agency customers) count as a Xero user, or do the agencies? Affects who signs what |
| DNS / email delivery | (unknown provider) | — | If custom domain emails are sent (transactional, resets), identify the provider and sign |

**Non-processors / out of scope:**

- GitHub, npm registry — infra dependencies, not processing user data.
- OpenAI / Anthropic — no LLM integration live in the product today.
  Note: Claude Code is used for development tooling, not production
  data, so it's not in scope.

---

## 4. Lawful basis per processing activity

Processing activities and the basis Therum relies on:

| Activity | Lawful basis | Notes |
|---|---|---|
| Maintaining staff user accounts | **Contract** (Art. 6(1)(b)) — need account to use the service | Falls away when account deleted |
| Storing agency-customer data (talent / clients / deals) | Therum is **processor** — no independent basis needed; agency's basis governs | Covered by DPA + customer contract |
| Audit logging staff actions | **Legitimate interest** (Art. 6(1)(f)) — security and dispute resolution | Needs balancing test; retention limited |
| Sentry error tracking (staff user context) | **Legitimate interest** — platform stability/debugging | PII redaction mitigates; retention limited by Sentry's own TTL |
| Marketing emails to staff users | **N/A today** — we don't send any. If we do, needs consent | |
| Impersonation audit trail (super admin) | **Legitimate interest + contract** — support + fraud prevention | Must be logged, as we currently do |

**Special category data ("sensitive" per Art. 9):** Currently none
stored. If future features add health/identity/political data, this
section gets rebuilt — need explicit consent or another Art. 9 basis.

---

## 5. Data subject rights — current capability

The four rights that apply here (there are more, but these are the
common-case requests):

### 5.1 Right of access (SAR)

A data subject asks "what data do you hold about me?" Must respond
within 30 days.

**Current state:** No self-service or ops tooling. A SAR would be
handled by ad-hoc database queries against `User`, `ClientContact`,
`Talent`, `Session`, `ImpersonationSession`, `AdminAuditLog`.

**Gap:** No documented process, no query template, no export format.
A dev currently has to build the response from scratch.

**Recommended action (code):** Build an internal
`/admin/data-subject-request` page that takes an email and returns all
rows across all tables where that email or the derived user ID
appears. JSON export. Ship **before launch**.

### 5.2 Right to erasure ("right to be forgotten")

Delete the person's data unless we have a legal/contractual reason to
retain.

**Current state:** No deletion flow. Cascading deletes via FK
`ON DELETE` exist for Deal/Milestone/ChaseNote relationships but the
app has no UI or action to trigger a User/Talent/ClientContact delete.

**Gap:** Major. Can technically fulfil via Supabase SQL editor, but no
verified, replayable process.

**Blockers for erasure:**

- **Contract retention.** Financial records (invoices, payouts, audit
  logs) generally must be retained for 6 years under UK corporate /
  HMRC rules. Erasure on these is "anonymise, don't delete." Needs a
  documented approach per data category.
- **Xero side.** Invoices pushed to Xero contain the data subject's
  details. Deleting from Therum doesn't delete from Xero. Need a
  separate process to contact Xero.
- **Sentry side.** Same — past error events may contain the user's
  context.

**Recommended action (code + ops):** Build a deletion flow that
(a) anonymises `User`, `Talent`, `ClientContact` rows (replace
identifying fields with tombstones, preserve FK integrity), (b) logs
the operation to `AdminAuditLog`, (c) flags the data subject so future
integrations know not to re-sync. **Ships before launch, even if
minimal.**

### 5.3 Right to rectification

Correct inaccurate data.

**Current state:** Partial. `User` profile is editable; `Talent` /
`ClientContact` are editable via agency portal. Good.

**Gap:** Minor — talent email is editable but no ceremony around it
(e.g. re-verification). Acceptable for launch.

### 5.4 Right to data portability

Export the data in a machine-readable format (CSV, JSON).

**Current state:** No export functionality.

**Gap:** The SAR endpoint above doubles as the portability endpoint if
it returns JSON. Same implementation.

### 5.5 Right to restrict / object / not be subject to automated decisions

- **Restrict processing:** Possible via the "portal disabled" flag on
  `Talent`. Can extend to other subjects if requested.
- **Object:** No automated marketing, no profiling. Low risk.
- **Automated decisions with legal effect:** None. Approval flows
  (invoice approval, stage transitions) are human-operated.

Acceptable for launch with documentation of the current low risk.

---

## 6. Data security

### 6.1 What's already in place

- **Transport encryption.** All traffic via HTTPS (Vercel + Supabase
  serve with valid TLS certs). HSTS on production domain.
- **Encryption at rest.** Supabase-managed, AES-256 on their Postgres
  infrastructure per their Trust documentation. Vercel-stored logs
  encrypted by Vercel. Sentry events encrypted at rest.
- **Authentication.** Supabase Auth handles password hashing
  (bcrypt/argon2 — verify current algorithm). MFA is available but
  not currently enforced — recommend enforcing for
  `AGENCY_ADMIN` / `SUPER_ADMIN` roles before launch.
- **Service role key.** Used server-side only
  (`SUPABASE_SERVICE_ROLE_KEY` with no `NEXT_PUBLIC_` prefix). Review
  rubric in `review-guidelines.md` catches misuse.
- **RLS policies.** Defined on every tenant-data table
  ([`supabase/migrations/20260420120000_add_rls_policies.sql`](../../supabase/migrations/20260420120000_add_rls_policies.sql)).
  Currently mostly dormant for reads — see
  [docs/rfc/001-rls-vs-service-role.md](../rfc/001-rls-vs-service-role.md).
  Tenant isolation is enforced in application code today; RLS is
  defence-in-depth.
- **Audit logging.** `AdminAuditLog` records sensitive actions
  (impersonation, invoice approval, data changes). Includes
  `actorUserId` and metadata.
- **Impersonation controls.** Only `SUPER_ADMIN` can impersonate;
  sessions are tracked in `ImpersonationSession`; writes during
  impersonation are blocked by default (THE-61).

### 6.2 Gaps

- **MFA not enforced.** Should be required for any role that can
  access multiple tenants (`SUPER_ADMIN`) and recommended for admin
  roles. Pre-launch action.
- **Passwords on User table.** `passwordHash` column is legacy and now
  NULL for all rows post-Supabase-Auth migration. Drop the column to
  remove the attack surface. Small migration; no live code depends
  on it.
- **Free-text note fields.** No PII detection / warning. Users can
  paste arbitrary personal data into `Deal.notes`, `ChaseNote.note`,
  etc. Acceptable for B2B SaaS if covered by our own Privacy Policy
  and customer's own use policy, but document it. **Lightweight
  mitigation for later:** a one-line tooltip under each note field
  ("Avoid entering personal phone numbers, home addresses, or
  sensitive details unless contractually necessary"). Zero
  enforcement, just a nudge — reduces incidental exposure without
  being heavy-handed.
- **No production-access audit on Supabase itself.** Super admins of
  the Therum org can see Supabase DB contents directly via the
  dashboard. Who has that access? Needs documenting. If
  external/contractor help is ever onboarded, same question.
- **No penetration test.** For B2B SaaS at our scale this isn't
  strictly required, but strongly recommended before a public launch.
  One-off engagement: £3k-£10k.

---

## 7. Data retention

UK GDPR says retain only as long as necessary. Therum has **no
documented retention policy today.** Every table grows unbounded.

### 7.1 Proposed retention matrix

| Data | Retention | Rationale |
|---|---|---|
| Financial records (Invoices, Milestones, audit logs of financial actions) | **6 years** after deal closure | HMRC / UK Companies Act record-keeping |
| User accounts (active) | While account active | Contract basis |
| User accounts (deactivated) | **90 days** then anonymise | Grace period for resurrection requests |
| Client / Talent / ClientContact data | While contract active + **6 years** post-termination for financial linkage | Same rationale as invoices |
| `Session`, `ResetToken` | **30 days** after expiry | Authentication retention |
| `AdminAuditLog` | **2 years** | Balance security evidence vs data-minimisation |
| `PreviewLog` | **90 days** | Behavioural log — short retention fine |
| Sentry error events | **90 days** (Sentry config) | Already configured |
| Vercel logs | **30 days** (Vercel default) | Vercel standard |

**Gap:** No automated retention process. Needs a scheduled job
(e.g. Vercel cron) that deletes / anonymises rows past retention
periods. Design work, ~2 days; can ship post-launch if documented.

---

## 8. Breach response

### 8.1 Regulatory requirement

UK GDPR Art. 33: notify ICO within **72 hours** of becoming aware of a
personal-data breach, unless the breach is unlikely to result in risk
to rights and freedoms. Art. 34: notify affected data subjects if
high-risk.

### 8.2 Current state

**Nothing documented.** If a breach happened today, the steps would
be invented in real time — which is exactly the scenario the 72-hour
window punishes.

### 8.3 Proposed runbook skeleton

1. **Detection / reporting channel.** Who can report a suspected
   breach? Security email alias (`security@therum.io`) + Sentry
   high-severity alerts.
2. **Triage (first 4 hours).** Confirm breach vs false positive.
   Identify scope: how many rows, which tables, which tenants, what
   data classes.
3. **Containment (first 24 hours).** Revoke compromised credentials
   (rotate service-role key, rotate Stripe/Xero keys, invalidate
   sessions), patch the root cause.
4. **Impact assessment.** Is the data likely to cause risk to rights
   and freedoms? (Financial data → yes. Non-PII system logs → no.)
5. **ICO notification (by hour 72).** Use the ICO's online form.
   Include: nature of breach, data categories, approximate numbers of
   subjects and records, likely consequences, measures taken.
6. **Affected-subject notification (if high-risk).** Direct email to
   data subjects OR affected customer agencies.
7. **Post-incident review.** Document timeline, root cause, preventive
   measures. File with the ticket system.

**Deliverable:** write this up as `docs/compliance/breach-response.md`
before launch. 1 day of work.

**Drill:** a runbook that has never been walked through fails the
first time it's needed — which is exactly when the 72-hour window
bites hardest. Once the doc exists, run a one-hour tabletop exercise
with a hypothetical scenario ("Supabase project token leaks in a
public gist at 18:00 Friday") to stress-test the escalation tree and
refine the runbook. Half-day of calendar time, one engineer + one
ops person.

---

## 9. ICO registration

Organisations processing personal data generally must register with
the ICO (pay an annual data protection fee, £40-£2,900 tiered by
size). Therum is almost certainly in scope.

**Action:** Register at https://ico.org.uk/for-organisations/data-protection-fee/. **Pre-launch blocker.**

**DPO requirement:** Mandatory under Art. 37 only if (a) public
authority, (b) large-scale systematic monitoring, or (c) large-scale
special category data. Therum meets none of these today. **Not
required,** but a nominated "Data Protection lead" internally is good
practice.

---

## 10. Pre-launch checklist

Categorised by type of action. Tick as each lands.

### 10.1 Legal / operational (non-code)

- [x] Privacy Policy published at https://therum.io/privacy-policy
  (SeedLegals, effective 12 March 2026)
- [ ] **Commission v2 revision of the Privacy Policy** per §11.4 —
  the live v1 materially under-describes what Therum actually does
  (data inventory, sub-processors, transfer mechanism, breach
  notification). Blocker for real-user onboarding.
- [ ] Sign Supabase DPA (via their dashboard/trust page)
- [ ] Sign Vercel DPA (via their dashboard)
- [ ] Sign Sentry DPA
- [ ] Sign Stripe DPA (when first real payout runs — flag for later)
- [ ] Clarify Xero controller-vs-processor framing with legal
- [ ] Draft + sign Therum's customer-facing DPA (the one agencies sign
  when they onboard) — becomes Schedule to the SaaS agreement
- [ ] Register with ICO; pay annual fee
- [ ] Nominate internal Data Protection lead
- [ ] Document sub-processor list publicly (Privacy Policy §X)
- [ ] Write `docs/compliance/breach-response.md` with the §8.3 runbook
- [ ] Document retention matrix in a customer-facing place

### 10.2 Code-track (blocks real-user onboarding)

- [ ] **Data subject access endpoint**
  (`/admin/data-subject-request`). Returns JSON of all rows
  containing the subject's email across every table.
- [ ] **Data erasure action** — anonymise `User`, `Talent`,
  `ClientContact` identifiers; preserve FK integrity; log to
  `AdminAuditLog`. Minimum viable version pre-launch.
- [ ] **Privacy Policy page** (`/privacy`), linked from login +
  footer.
- [ ] **Cookie notice** if we add analytics that use non-essential
  cookies (today we use Supabase session cookies only, which are
  strictly necessary — likely no cookie banner needed, but confirm).
- [ ] **MFA enforcement** for `SUPER_ADMIN` accounts at least.
- [ ] **Drop `User.passwordHash`** column — legacy post-Supabase-Auth,
  no code depends on it (audit first).

### 10.3 Code-track (nice-to-have, post-launch OK)

- [ ] Scheduled retention-cleanup job (applies §7.1 retention matrix)
- [ ] Sentry sample redaction audit against real production events
  (already tracked in [THE-64](https://linear.app/therum/issue/THE-64))
- [ ] PII-in-free-text-notes detection warning at form level (Deal
  notes, ChaseNote, etc.) — low-priority polish
- [ ] Export data in CSV alongside JSON for the SAR endpoint

---

## 11. Live Privacy Policy audit

The live policy at **https://therum.io/privacy-policy** (effective
12 March 2026, drafted by SeedLegals) was reviewed against the data
inventory in §2 and the processing activities in §4. The Policy
exists but **materially under-describes what Therum actually does**.
Several sections need revision before onboarding real users — a
policy that misdescribes processing is arguably worse than no policy,
because it creates a transparency/accuracy breach under UK GDPR
Art. 5(1)(a) and Arts. 13/14.

### 11.0 At-a-glance — for SeedLegals

| § | Severity | Problem | Fix |
|---|---|---|---|
| 2.1 | 🔴 | Data inventory lists only "Contact Data"; misses authentication, financial, company identifiers, audit logs, free-text notes, impersonation sessions | Expand to all categories in §2 of this assessment |
| 5 | 🔴 | Zero sub-processors disclosed; only mentions change-of-control scenarios | Add sub-processor list: Supabase, Vercel, Sentry, Stripe, Xero — role, data shared, DPA status |
| 7 | 🔴 | "Consent" used as international-transfer mechanism (ICO disfavours); also references "outside the US" (Therum is UK-based) | Replace with UK IDTA / SCC mechanism; correct UK reference; name target countries |
| (new) | 🔴 | No Art. 33/34 breach-notification commitment from Therum itself | Add 72-hour ICO notification + affected-subject notification commitment |
| 6 | 🟠 | Retention is "as long as reasonably necessary" — barely meets Arts. 13/14 "period or criteria" bar | Link/name the retention matrix: financial = 6y, authentication = 2y, error logs = 90d, etc. |
| 1.3 | 🟠 | Defines "Processor" as employees (wrong under GDPR — employees act under controller's authority) | Rename to "Our staff and sub-processors"; split clearly |
| 8 | 🟠 | Continued-use-equals-consent for material changes (ICO expects active notification) | 30-day email notice for material changes; continued use only for editorial |
| (new) | 🟠 | No cookie statement | One line: "strictly necessary session cookies only" — holds until we add analytics |

Counsel cost estimate: **2-3 hours of revision time** (not drafting
from scratch). Details and excerpts behind each finding in §11.2–11.3
below.

### 11.1 What's good

- **Controller identity + contact** clearly stated (§1.2): Therum
  Technologies Ltd, Co. No. 17072773, 3rd Floor, 86-90 Paul Street,
  London, EC2A 4NE. Contact email `bhavik@therum.io`.
- **DPO position** documented explicitly (§1.2) — not appointed,
  which is fine given we don't hit Art. 37 triggers.
- **All seven data-subject rights listed** in §4.1 (access,
  rectification, erasure, restriction, portability, object, be
  informed). Correctly described.
- **Fee-free SAR commitment** (§4.3) — matches GDPR default.
- **ICO as supervisory authority acknowledged** (§1.2, §4.3).

### 11.2 Material gaps — revise before onboarding real users

#### 🔴 §2.1 — Data inventory is vastly incomplete

The Policy says we collect only:

> "Contact Data: Your phone number, addresses, and email addresses."

In reality (see §2 of this assessment) we also process:

- **Authentication data** — hashed passwords via Supabase, session
  tokens, `authUserId`, login timestamps
- **Financial data** — invoice values, commission rates, payouts,
  VAT numbers, bank-account references (`Talent.stripeAccountId`)
- **Company identifiers** — `Talent.companyName`,
  `companyRegNumber`, `registeredAddress`
- **Free-text notes** across Deal, Milestone, ClientContact,
  ChaseNote — could contain arbitrary PII
- **Audit logs** of user actions (who approved what, when)
- **Impersonation sessions** (super-admin acting as an agency)

Under UK GDPR Art. 13(1)(c) and 14(1)(d), the controller must
disclose the **categories of personal data** it collects. Listing
only "Contact Data" when there's a whole ledger of financial and
identifier data is a transparency failure.

**Fix:** rewrite §2.1 to enumerate all categories, matching the
inventory in this assessment. Mention that free-text fields may
incidentally contain additional PII supplied by the controller
(the agency customer).

#### 🔴 §5 — Zero sub-processor disclosure

The Policy's "Your Data & Third Parties" section (§5.1) only covers
*change-of-control* scenarios (sale of business). It never names
Supabase, Vercel, Sentry, Stripe, or Xero — the actual sub-processors
that hold or touch personal data daily.

Under Art. 28 and ICO guidance, the controller must identify
sub-processors (by category at minimum, by name as best practice) in
transparency notices. Missing this is a major disclosure gap.

**Fix:** add a §5.2 listing current sub-processors with:
- Their identity and role (Supabase = database + auth; Vercel = hosting; etc.)
- The category of data shared with each
- A link to each sub-processor's own privacy documentation
- A statement that DPAs are in place (once they are — see §3 of this assessment)

#### 🔴 §7 — International-transfer mechanism is weak

Current wording:

> "By using Therum Technologies Ltd, you are permitting and consenting
> to the transfer of information, including Personal Data, outside of
> the US."

Two problems:

1. "Outside of the US" — Therum is UK-based. This wording looks like
   a US-to-UK template drift; it should be "outside the UK/EEA."
2. **Consent as a transfer mechanism** — the ICO strongly disfavours
   Art. 49(1)(a) consent for ongoing commercial transfers. The
   proper mechanism is the **UK International Data Transfer Agreement
   (IDTA)** or the EU SCCs with the UK Addendum, typically attached
   to each sub-processor's DPA.

**Fix:** revise §7 to:
- Correct the UK reference
- Name the IDTA/SCC mechanism
- Name the countries data is transferred to (US for most
  sub-processors — Supabase, Vercel, Sentry, Stripe; possibly
  NZ/AU for Xero)

#### 🟠 §6 — Retention description is too vague

> "We will only retain your Personal Data for as long as reasonably
> necessary to fulfil the purposes we collected it for."

Art. 13(2)(a) / 14(2)(a) requires disclosing either the retention
period or **the criteria used to determine it**. The current wording
barely meets the "criteria" bar and is weaker than most SaaS peers.

**Fix:** link to the retention matrix (proposed in §7 of this
assessment) or restate the key ones inline: "financial records for 6
years post-contract termination to meet HMRC/Companies Act
obligations; authentication metadata for up to 2 years; error logs
for 90 days."

#### 🟠 §1.3 — "Processor" definition is confused

The Policy says:

> "we have employees who will deal with your data on our behalf
> (known as 'Processors')"

Under GDPR, **employees are not processors**. Processors are separate
legal entities (Supabase, Vercel, etc.). Employees act under the
controller's authority per Art. 29.

This isn't a showstopper (no one gets fined for mislabelling
internally) but it does suggest the Policy was templated rather than
fitted, and risks being flagged by a sharp auditor.

**Fix:** rename the section to "Our staff and sub-processors" and
split into two short paragraphs — one on internal staff handling
data under confidentiality, one on external sub-processors bound by
DPAs.

#### 🟠 §8 — Consent model for policy changes

> "Continued access or use of Therum Technologies Ltd will constitute
> your express acceptance of any modifications to this Privacy
> Policy."

Continued-use-equals-consent is a weak mechanism for **material**
changes. ICO expects active notification (email with 30-day notice,
or in-app banner) when processing purposes or sub-processors change.
Minor editorial changes are fine under the current wording.

**Fix:** soften to: "For material changes (new processing purposes,
new sub-processors, changes to retention), we will notify agency
admins by email at least 30 days before the change takes effect.
For minor editorial changes, continued use constitutes acceptance."

### 11.3 Missing entirely — add before launch

#### 🔴 Breach-notification commitment

The Policy mentions in §1.3 that processors (which it confusingly
defines as employees) must notify the Controller of a breach. It
does **not** commit Therum itself to:

- Notify the ICO within 72 hours per Art. 33
- Notify affected data subjects without undue delay per Art. 34
- Keep an internal breach register per Art. 33(5)

**Fix:** add a new section (§6a or §9) stating the 72-hour
commitment and pointing affected subjects to the breach-response
runbook (tracked in §8 of this assessment).

#### 🟠 Cookie notice

The Policy doesn't mention cookies. If we only use **strictly
necessary** cookies (Supabase session for auth — currently the case)
this is fine; strictly necessary cookies don't require consent under
PECR. If we ever add analytics or marketing pixels, a cookie banner
+ notice becomes mandatory.

**Fix for now:** add a one-line statement — "We use strictly
necessary cookies only for authentication. No analytics or marketing
cookies are set by this site." Then it stays accurate until we
change behaviour.

### 11.4 Revision plan

Summary of what should go back to SeedLegals (or equivalent counsel)
for a v2 of the Policy:

| # | Section | Change |
|---|---|---|
| 1 | §2.1 | Expand data inventory to cover all categories |
| 2 | §5 | Add sub-processor list with identities, roles, data shared |
| 3 | §7 | Replace consent-based transfer language with IDTA/SCC mechanism; correct UK reference |
| 4 | §6 | Name retention periods or criteria; link to retention matrix |
| 5 | §1.3 | Disentangle "Processor" definition |
| 6 | §8 | Active notification for material changes |
| 7 | new | Breach-notification commitment |
| 8 | new | Cookie statement (even if "strictly necessary only") |

Estimated counsel time: 2-3 hours on SeedLegals' hourly, plus
Therum's review/sign-off.

Until v2 ships and is live, **do not onboard users outside the beta
invitation list** — the current Policy materially misdescribes what
we do.

---

## 12. Estimated effort

| Workstream | Effort | Who |
|---|---|---|
| Privacy Policy v2 per §11.4 (SeedLegals revision + review) | 2-3 hours counsel + 0.5 day Therum | External counsel + Ops |
| Customer DPA drafting (Schedule to SaaS agreement) | 1-2 days | External counsel |
| Sub-processor DPAs (signing / admin) | 0.5 days | Ops |
| ICO registration | 1 hour | Ops |
| Data-subject-request endpoint | 1 day | Eng |
| Erasure flow (minimum viable) | 2 days | Eng |
| MFA enforcement for SUPER_ADMIN | 0.5 days | Eng |
| Drop `User.passwordHash` (migration + audit) | 0.5 days | Eng |
| Breach response runbook | 1 day | Eng + Ops |
| Retention-cleanup cron (post-launch OK) | 2 days | Eng |
| **Total blocker effort to green-light launch** | **~1-2 weeks** | |

---

## 13. Open questions for legal

These need a qualified opinion before the Privacy Policy publishes:

1. **Xero relationship** — joint controller or sub-processor? Affects
   who signs what and whether Xero's own Privacy Policy is referenced
   or integrated.
2. **Talent contracts containing special-category data** — if an
   agency's contracts with talent reference health/disability
   accommodations, does that put those notes into Art. 9 territory?
   Likely a per-agency decision documented in the customer DPA.
3. **Cross-border data transfer mechanism** — confirm each US
   sub-processor has a currently-valid IDTA in place.
4. **DPIA threshold** — Art. 35 mandates a Data Protection Impact
   Assessment when processing is "likely to result in a high risk to
   the rights and freedoms of natural persons," specifically:
   (a) systematic and extensive evaluation based on automated
   processing, including profiling, with legal or similarly
   significant effects; (b) processing on a large scale of
   special-category data (Art. 9) or criminal-offence data;
   (c) systematic monitoring of a publicly accessible area on a
   large scale. **Therum does not currently meet any of these three
   thresholds** (no profiling with legal effects; no special-category
   data; no public-area monitoring). Confirmation that this reading
   is correct, and that processing scale doesn't push us into the
   ICO's supplementary list of "likely to require DPIA" scenarios,
   would close the question formally.

---

## Appendix — related documents

- [`docs/rfc/001-rls-vs-service-role.md`](../rfc/001-rls-vs-service-role.md)
  — security/RLS architecture and migration plan
- [`docs/compliance/supabase-rls-strategy.md`](./supabase-rls-strategy.md)
  — current RLS posture
- [`supabase/migrations/20260420120000_add_rls_policies.sql`](../../supabase/migrations/20260420120000_add_rls_policies.sql)
  — actual policies
- [`src/types/database.ts`](../../src/types/database.ts) — canonical
  schema + personal-data surface
- [THE-54](https://linear.app/therum/issue/THE-54) / [THE-64](https://linear.app/therum/issue/THE-64)
  — Sentry PII redaction work
- [THE-61](https://linear.app/therum/issue/THE-61) — impersonation write-lockout
