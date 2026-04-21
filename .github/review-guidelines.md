# Therum PR Review Guidelines
# Used by Claude automated PR review — .github/scripts/review-pr.js
# Last updated: April 2026

---

## Severity Levels

🔴 BLOCKER — Must be fixed before merge. Security vulnerabilities, data integrity failures, financial calculation errors, tenant isolation breaches. A PR with any BLOCKER must not be merged.

🟠 HIGH — Should be fixed before merge. Will cause real problems in production.

🟡 MEDIUM — Should be addressed soon. Can merge with a Linear ticket to track.

🟢 SUGGESTION — Non-blocking improvement.

---

## Supabase Schema Reference

Table names are PascalCase. Flag queries referencing unknown columns as 🟠 HIGH.

### Agency
id, name, slug, active, planTier (enum DEFAULT 'BETA'), xeroTenantId, xeroTokens (text — plain text, not encrypted), stripeAccountId, commissionDefault (numeric), invoicingModel (enum — SELF_BILLING|ON_BEHALF), vatRegistered, vatNumber, xeroAccountCodes (jsonb), createdAt, updatedAt

### User
id (matches auth.uid()), agencyId, email, role (enum — AGENCY|FINANCE|TALENT|ADMIN), talentId (only set if role=TALENT), createdAt

### Client
id, agencyId, name, paymentTermsDays (DEFAULT 30), xeroContactId, vatNumber, notes, createdAt, updatedAt

### ClientContact
id, clientId, agencyId, name, email, role (enum DEFAULT 'OTHER' — PRIMARY|FINANCE|OTHER), phone, notes, createdAt, updatedAt

### Talent
id, agencyId, name, email, commissionRate (numeric), vatRegistered, vatNumber, stripeAccountId, xeroContactId, portalAccessEnabled, createdAt, updatedAt

### Deal
id, agencyId, clientId, talentId, title, stage (enum DEFAULT 'PIPELINE' — PIPELINE|CONTRACTED|ACTIVE|COMPLETED|CANCELLED), commissionRate (numeric), paymentTermsDays, currency (DEFAULT 'GBP'), contractRef, notes, probability (DEFAULT 10), createdAt, updatedAt

### Milestone
id, agencyId, dealId, title, amount (numeric — ⚠️ should be integer pence), invoiceDate (tax point — editable pre-push), deliveryDueDate, deliverableComplete, payoutStatus (enum DEFAULT 'PENDING'), cancelledByTripletId, replacedCancelledMilestoneId, createdAt, updatedAt

### Deliverable
id, milestoneId, title, dueDate, status (enum DEFAULT 'PENDING')
⚠️ NO agencyId column — RLS must join through Milestone

### InvoiceTriplet
id, agencyId, milestoneId
SELF_BILLING fields (null if ON_BEHALF): invNumber, sbiNumber
ON_BEHALF fields (null if SELF_BILLING): obiNumber, cnNumber
Both models: comNumber, status (enum DEFAULT 'DRAFT' — DRAFT|PENDING_APPROVAL|PUSHED_TO_XERO|PAID|CANCELLED), issuedAt (IMMUTABLE once approvalStatus='APPROVED'), createdAt

### ManualCreditNote
id, agencyId, createdAt

### DealExpense
id, agencyId, dealId, milestoneId (nullable), description, category (enum), amount (numeric — ⚠️ should be integer pence), currency, vatApplicable, incurredBy (enum), rechargeable, contractSignOff, status (enum DEFAULT 'PENDING'), approvedById, approvedAt, receiptUrl, supplierRef, notes, invoiceLineRef, invoicedOnInvId, createdAt, updatedAt

### ChaseNote
id, invoiceTripletId, agencyId, createdByUserId, contactedName, contactedEmail, method (enum), note, nextChaseDate, createdAt

### Session
id, userId — user-scoped not agency-scoped

### ResetToken
id, userId — user-scoped not agency-scoped

### AdminAuditLog — admin/service-role only
id, actorUserId, action, targetType, targetId, metadata (jsonb), createdAt

### ImpersonationSession — admin/service-role only
id, adminUserId, agencyId, startedAt, endedAt, endedByUserId

### PreviewLog — system only

---

## Known Schema Issues to Flag

🟠 HIGH: Milestone.amount is numeric not integer — flag any NEW code adding numeric/float financial columns
🟠 HIGH: DealExpense.amount is numeric not integer — same
🟡 MEDIUM: Deliverable has no agencyId — flag direct Deliverable queries not accounting for this
🟡 MEDIUM: Agency.xeroTokens is plain text — flag any code reading/writing without encryption

---

## Financial Logic Rules

### SELF_BILLING Model — INV/SBI/COM

1. Milestone marked complete
2. INV generated — Agency → Brand client (ACCREC in Xero). Gross deal value + 20% VAT
3. SBI generated — Agency on behalf of Talent (ACCPAY in Xero). Gross deal value pre-commission. This is COGS.
4. COM generated — Agency → Talent (ACCREC in Xero). Gross × commissionRate
5. All three pushed to Xero atomically on Finance Portal approval
6. INV paid webhook fires → milestone becomes payout-eligible
7. Net payout = gross − commission

### ON_BEHALF Model — OBI/CN/COM

1. Milestone marked complete
2. OBI + CN + COM generated as a triplet. CN mirrors OBI gross exactly.
3. Finance Portal approval: OBI, CN, and COM pushed to Xero in the same
   batch (same Xero session). All three or none — atomic.
4. xeroCnId stored on the InvoiceTriplet immediately after push.
5. Brand client pays OBI.
6. Xero webhook fires → OBI marked PAID → milestone payout-eligible.
   CN already exists in Xero from step 3.
7. Net payout = OBI gross − COM amount.

Key rule: CN is NOT raised after payment. It is pushed atomically with
OBI and COM on Finance Portal approval. Pushing OBI without CN in the
same batch is a 🔴 BLOCKER — it breaks P&L netting in Xero.

### Net Payout Calculation (both models)
netPayout = grossAmount - commissionAmount
commissionAmount = grossAmount × commissionRate
Example: £12,000 × 20% = £2,400 commission. £12,000 − £2,400 = £9,600 to talent.
ALWAYS store amounts in pence (integer). Never pounds as float.

### Atomicity Rule
INV+SBI+COM or OBI+COM must be created in a single database transaction.
Never partially — all or nothing. If Xero push fails, roll back entire triplet to DRAFT.

---

## The 10 Things That Must Never Happen

All 🔴 BLOCKER — no exceptions.

1. Agency A can read or write Agency B's data
2. Payout triggered before client invoice is PAID in Xero
3. INV/SBI/COM or OBI/CN/COM triplet created partially
11. ON_BEHALF OBI pushed to Xero without CN and COM in the same approval batch
4. Payout amount calculated client-side
5. Xero webhook processes payload with invalid HMAC signature
6. InvoiceTriplet.issuedAt modified after approvalStatus='APPROVED'
7. Talent in ON_BEHALF model sees a CN in their portal
8. VAT threshold calculations use payment date instead of invoiceDate
9. SUPABASE_SERVICE_ROLE_KEY used client-side or exposed via NEXT_PUBLIC_
10. Payout run proceeds when Stripe balance is insufficient

---

## Supabase Schema Changes

Schema changes are applied manually via the Supabase SQL editor — not via CI. A "schema change" means a new/renamed/dropped table or column, a new enum value, a new or altered RLS policy, a new index, a new trigger, or a new/altered Postgres function.

Rules for any PR that assumes a schema change:

1. The exact SQL that was applied must appear in the PR description, as a fenced ```sql block, so reviewers can audit it against the code.
2. The same SQL must also be committed as a new file in `supabase/migrations/`, named `YYYYMMDDHHMMSS_snake_case_description.sql`. This is our only source-controlled record of schema deltas.
3. Existing migration files must not be edited, renamed, or deleted — they are immutable. If you need to change something, add a new migration. CI enforces this via `.github/workflows/supabase-migrations.yml`.

🔴 BLOCKER: PR code references a column, table, enum value, or RLS policy that does not exist in the current Supabase schema and has no accompanying SQL block in the PR description
🔴 BLOCKER: SQL block in PR description references objects the applied schema doesn't have (copy-paste mismatch between what was run and what's documented)
🟠 HIGH: Schema change documented in PR description but no matching file added to `supabase/migrations/` — forward-facing history will drift
🟠 HIGH: New table created without RLS enabled and an agency isolation policy in the same SQL block (see "Supabase RLS Requirements" below)

---

## Supabase RLS Requirements

🔴 BLOCKER: New table with agency data and no RLS policy
🔴 BLOCKER: RLS policy that doesn't filter by agencyId
🟠 HIGH: Supabase query in server code missing agencyId in WHERE clause
🟠 HIGH: SUPABASE_SERVICE_ROLE_KEY referenced outside /app/api/
🔴 BLOCKER: SUPABASE_SERVICE_ROLE_KEY in client component or NEXT_PUBLIC_

Required pattern:
ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_isolation" ON "TableName"
  FOR ALL USING (agencyId = get_current_agency_id());

---

## Portal Access Control

### AGENCY role
- Full read/write on own agency deals, milestones, clients, talent
- Cannot access /finance/* routes
- Cannot approve invoices or initiate payout runs

### FINANCE role
- Invoice approval, payout runs, Xero sync, VAT dashboard
- Read-only on deals and milestones
- Cannot access agency settings

### TALENT role
- Own deals and milestones only
- SELF_BILLING: sees INV and SBI references
- ON_BEHALF: sees OBI tab only — CN NEVER visible to talent
- Cannot see other talent's data

🔴 BLOCKER: Talent can see another talent's data
🔴 BLOCKER: ON_BEHALF talent can see CN
🔴 BLOCKER: Role checked client-side only — must always be server-side
🟠 HIGH: Finance Portal route accessible without FINANCE role check

---

## Xero Integration Rules

Source of truth: Xero = payment status. Therum = invoice creation.

🔴 BLOCKER: Webhook route missing bodyParser: false
🔴 BLOCKER: HMAC not validated before processing Xero payload
🔴 BLOCKER: Invoice payment status updated from client-side code
🟠 HIGH: Xero API call with no error handling
🟠 HIGH: Xero invoice pushed without storing returned xeroId

HMAC pattern:
const hmac = crypto.createHmac('sha256', process.env.XERO_WEBHOOK_KEY!).update(rawBody).digest('base64')
if (hmac !== signature) return 401

---

## Stripe Connect Rules

🔴 BLOCKER: Payout transfer before INV/OBI confirmed PAID
🔴 BLOCKER: stripe.payouts used instead of stripe.transfers
🔴 BLOCKER: Stripe webhook signature not validated
🔴 BLOCKER: Payout run proceeds without Stripe balance check
🟠 HIGH: Transfer metadata missing dealId, milestoneId, or SBI reference
🟠 HIGH: Stripe secret key in client component

---

## VAT Threshold Rules

UK threshold: £90,000 rolling 12 months. Date basis: invoiceDate — NOT payment date.

Tiers: APPROACHING ≥£75k · IMMINENT ≥£85k · BREACHED ≥£90k

🔴 BLOCKER: VAT threshold calculated using payment date
🟠 HIGH: VAT alert shown for talent where vatRegistered = true
🟠 HIGH: Pipeline deals excluded from breach projection

---

## API Route Rules

🔴 BLOCKER: No auth check on a route accessing agency data
🔴 BLOCKER: Stack trace returned to client
🟠 HIGH: Request body not validated with Zod before database operation
🟠 HIGH: Multiple dependent writes outside a transaction
🟡 MEDIUM: Inconsistent error response shape
🟡 MEDIUM: Wrong HTTP status code

---

## Environment Variable Rules

🔴 BLOCKER: Any secret hardcoded in source code
🔴 BLOCKER: SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_ prefix
🔴 BLOCKER: STRIPE_SECRET_KEY with NEXT_PUBLIC_ prefix
🟠 HIGH: New required env var not added to .env.example
🟡 MEDIUM: Env var accessed without existence check
