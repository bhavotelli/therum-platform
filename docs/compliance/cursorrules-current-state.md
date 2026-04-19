# Cursorrules vs product docs vs code — current state

This document reconciles three sources so you can see **what matches**, **what conflicts**, and **what to change next** (rules, code, or internal specs).

| Source | Role |
|--------|------|
| [`cursorrules`](../../cursorrules) | AI/engineering guardrails in-repo |
| [`GEMINI.md`](../../GEMINI.md) / [`BETA.md`](../../BETA.md) | Long-form product / platform narrative (not all implemented) |
| `src/` | Actual behavior |

The [2026-04-19 audit](./cursorrules-audit-2026-04-19.md) flagged gaps; this file explains **which gaps are bugs vs intentional MVP vs spec disagreement**.

---

## 1. Quick matrix

| Topic | `cursorrules` | Code today | Verdict |
|--------|----------------|------------|---------|
| **Service role key** | Only in `/app/api` | Used in Server Components, server actions, `src/lib` (server-only) | **Rule outdated** — keys never reach the client; keep server-only discipline + `agencyId` checks. |
| **RLS** | Policies in migrations; `agency_id` in RLS | RLS enabled; **no `CREATE POLICY` in repo**; service role bypasses RLS; tenancy in TypeScript | **Partial** — defense vs anon PostgREST misuse; policies not versioned. |
| **Xero webhook** | Raw body + HMAC | [`src/app/api/webhooks/xero/route.ts`](../../src/app/api/webhooks/xero/route.ts), HMAC on raw body; empty intent-to-receive | **Aligned** — ensure signing key set in production. |
| **Stripe webhook** | Verify signatures | Verified; handlers mostly stub | **Aligned** for beta / “not automated yet”. |
| **SELF_BILLING milestone → triplet** | Atomic INV/SBI/COM | [`markMilestoneComplete`](../../src/app/(agency)/agency/pipeline/[id]/actions.ts) creates one triplet with model-appropriate fields | **Aligned** at triplet creation. |
| **ON_BEHALF Xero push** | OBI + settlement CN + COM in one approval batch | [`pushInvoiceTripletToXero`](../../src/lib/xero-sync.ts) pushes **OBI → settlement CN (full gross) → COM**; stores `xeroObiId`, `xeroCnId`, `xeroComId` | **Aligned** with GEMINI / updated `cursorrules`. |
| **ON_BEHALF payout `READY`** | OBI paid in Xero; CN from approval (`xeroCnId`) | Webhook sets `invPaidAt` + `READY` on payment; settlement CN already exists from step 3 | **Aligned** — eligibility is OBI paid via webhook once CN exists from push. |
| **Manual / amendment CNs** | — | [`amendApprovedObiTriplet`](../../src/app/(finance)/finance/invoices/actions.ts), `ManualCreditNote` | **Separate** from the initial settlement CN; used for post-approval decreases / re-raise flows. |
| **Talent sees CN** | Never (ON_BEHALF) | [`getTalentPortalData`](../../src/lib/talent-portal.ts) exposes OBI/COM refs, not CN detail | **Aligned**. |
| **VAT threshold** | Rolling 12-month, tiers, invoice date basis | [`vat-monitor`](../../src/app/(agency)/agency/vat-monitor/page.tsx) / [`vat-compliance`](../../src/app/(finance)/finance/vat-compliance/page.tsx) placeholders | **Not implemented**. |
| **Portal / 403** | Prefer 403 for wrong role | [`proxy.ts`](../../src/proxy.ts) redirects to role home | **UX choice** vs literal rule. |
| **Zod on APIs** | Required | Not used in `src/` | **Gap**. |

---

## 2. ON_BEHALF (aligned with GEMINI)

**Approval:** [`pushInvoiceTripletToXero`](../../src/lib/xero-sync.ts) pushes **OBI → settlement CN (full OBI gross, CN account code) → COM** in one Finance approval flow. `InvoiceTriplet.xeroCnId` stores the settlement credit note id.

**Webhook:** When the client pays the OBI in Xero, [`syncInvoiceFromXeroEvent`](../../src/lib/xero-sync.ts) sets `invPaidAt` and milestone `payoutStatus` → `READY`. The settlement CN already exists from approval.

**Later adjustments:** Partial CNs and re-raise flows use [`ManualCreditNote`](../../src/types/database.ts) / `pushObiCreditNoteToXero` — separate from the initial OBI/CN/COM batch.

**Optional GEMINI follow-up:** Allocating the CN to the OBI in Xero at payout confirmation (API) is **not** implemented here; add when you automate Xero settlement on payout.

---

## 3. What is “correct” right now (working definition)

1. **Security:** No service role or Stripe secrets in client bundles; finance/agency scoped by resolved `agencyId`.
2. **ON_BEHALF:** OBI + settlement CN + COM at approval; `cursorrules` §4 updated to match.
3. **RLS:** See [`supabase-rls-strategy.md`](./supabase-rls-strategy.md) — enabled; full policy + user-scoped client migration is a **planned hardening** step.
4. **VAT:** Not built — placeholders only.

---

## 4. Other backlog items (from audit)

| Item | Suggested acceptance |
|------|----------------------|
| RLS policies in repo | New migration(s) with `CREATE POLICY` **or** documented exception that app-only access uses service role + explicit filters. |
| Zod | Add Zod to server actions / API routes that mutate financial state. |
| Xero webhook in prod | `XERO_WEBHOOK_KEY` / `XERO_WEBHOOK_SIGNING_KEY` required; remove or narrow dev-only bypass. |

---

## 5. Related files

- Audit: [`docs/compliance/cursorrules-audit-2026-04-19.md`](./cursorrules-audit-2026-04-19.md)
- RLS strategy: [`docs/compliance/supabase-rls-strategy.md`](./supabase-rls-strategy.md)
- OBI amendment UAT: [`docs/finance/obi-cn-uat-checklist.md`](../finance/obi-cn-uat-checklist.md)
- CLI check (amendment CN cycles): `npm run verify:obi-cn -- triplet=<id>`
