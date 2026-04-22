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

**Critical blockers for launch** (legal/operational, not code):

1. Privacy Policy published at a stable URL and linked from the login
   page.
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
mostly non-code (legal drafting, vendor admin, ICO forms). Code
changes are minor — a Privacy Policy page, a data-export endpoint, and
a data-deletion flow.

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
  THE-65, passwords live in Supabase Auth, not the app DB). Worth a
  follow-up ticket to null-out + drop the column to reduce attack
  surface.
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
  and customer's own use policy, but document it.
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

- [ ] Publish Privacy Policy at `/privacy` and link from login page
  (skeleton in §11 below; needs legal review before publishing)
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

## 11. Privacy Policy — skeleton / starter draft

> **⚠️ LEGAL REVIEW REQUIRED.** The text below is a working draft
> based on the data inventory above. Every clause needs review by
> someone qualified in UK data protection law before this is
> published at `/privacy`. Do not publish verbatim.

### Who we are

Therum Technologies Ltd is the data controller for the personal data
of its own users (agency staff, super admins) and a data processor
for personal data processed on behalf of its agency customers (talent,
client contacts, deal data).

Contact: privacy@therum.io
Registered address: [to fill]
ICO registration: [to fill once registered]

### What we collect

**As controller** (our own users):

- Name, email address, role within an agency
- Authentication metadata (login times, session tokens — see our
  security section)
- Actions taken in the platform (what you approved, what you
  impersonated, etc.) for security and support

**As processor** (data you give us to hold on behalf of your agency):

- Talent / client / contact details (name, email, phone, address,
  company registration, VAT number, bank-account references)
- Deal, milestone, and invoice data
- Notes you type into free-text fields

### Why we process it

- **Contract.** To provide the services agreed under our SaaS
  agreement with your agency.
- **Legitimate interest.** For security (audit logs), product
  stability (error tracking), support (impersonation for
  troubleshooting). We balance these against your rights and log
  access so you can see what happened.

### Who we share it with

Our sub-processors, each covered by a DPA:

- **Supabase Inc.** — database, authentication, file storage
- **Vercel Inc.** — application hosting
- **Sentry (Functional Software Inc.)** — error tracking (includes
  redacted user context)
- **Stripe Inc.** — payment processing (when live payouts are
  enabled)
- **Xero (NZ) Ltd** — accounting integration (invoices and their
  contact details are pushed to Xero on approval)

### International transfers

Some sub-processors (Supabase, Vercel, Sentry, Stripe) are US-based
and some data processing happens outside the UK. Transfers rely on
the UK IDTA / Standard Contractual Clauses (SCCs) attached to each
DPA.

### How long we keep it

Per the retention matrix at [link] — broadly:

- Active customer data: for the duration of your contract
- Financial records: 6 years (HMRC / Companies Act)
- Authentication logs: up to 2 years
- Error logs: 90 days

### Your rights

You can request access, erasure (subject to financial-record
retention), rectification, and portability by emailing
privacy@therum.io. We'll respond within 30 days.

### How we protect it

- Encryption in transit (HTTPS) and at rest (Supabase-managed
  AES-256).
- Role-based access control with row-level security in the database.
- Mandatory MFA for super-admin accounts.
- Audit logging of sensitive actions.
- Sub-processors are SOC 2 / ISO 27001 certified (see their Trust
  pages).

### Breach notification

We commit to notifying affected customers of any personal-data
breach without undue delay, and reporting to the ICO within 72 hours
where required.

### Changes

We'll notify agency admins via email of material changes to this
policy, and update the "last updated" date at the top of this page.

### Contact the ICO

If you're unhappy with how we've handled your data, you can contact
the UK Information Commissioner's Office at https://ico.org.uk.

---

## 12. Estimated effort

| Workstream | Effort | Who |
|---|---|---|
| Legal drafting (Privacy Policy, customer DPA) | 2-3 days | External counsel recommended |
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
4. **DPIA threshold** — do we need a Data Protection Impact Assessment
   given the scale of financial data processed? Probably not at
   current scale but worth confirming.

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
