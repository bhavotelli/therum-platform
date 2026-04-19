# Therum cursorrules compliance audit

**Date:** 2026-04-19  
**Scope:** Local tree + `origin/main` + open GitHub PRs  
**Reference:** [`cursorrules`](../../cursorrules) (root of repo)

**Reconciliation (spec vs code):** See [`cursorrules-current-state.md`](./cursorrules-current-state.md) — especially **ON_BEHALF**, where `cursorrules`, `GEMINI.md`, and the implementation disagree; the audit findings below should be read together with that doc.

## Executive summary

The codebase aligns with several security and integration rules (Xero webhook raw body + HMAC, Stripe signature verification skeleton, server-side financial math for milestone completion, finance tenant checks via `agencyId`). There are **important gaps** versus the written rules: **ON_BEHALF payout readiness does not enforce the credit-note step**, **VAT threshold monitoring is not implemented** (placeholder UI only), **RLS policies are not defined in migrations**, and **API validation / HTTP semantics** diverge from §8 and §10. The literal rule that limits the Supabase **service role** to `/app/api` is **not** how the app is built; the implementation is server-only and does not expose secrets to the browser—update the rule or plan a long-term move to user-scoped clients + RLS-backed queries.

---

## GitHub reconciliation

| Check | Result |
|--------|--------|
| `main` vs `origin/main` | **Identical** at `17a09a952f4a13c98744462b62525fd81deb151c` (after `git fetch origin`) |
| Open PRs (`https://api.github.com/repos/bhavotelli/therum-platform/pulls?state=open`) | **None** |
| `gh` CLI | Not available in the audit environment; PR list taken from GitHub API |

A local branch `feat/supabase-auth-xero-cutover` exists on the remote; it was not reviewed as an open PR.

---

## Findings by severity

### Critical

_None identified that would immediately expose the service role to the browser or allow cross-tenant reads without server checks._

### High

1. **ON_BEHALF settlement CN (was High — addressed 2026-04-19)**  
   **Resolution:** [`pushInvoiceTripletToXero`](../../src/lib/xero-sync.ts) now pushes **OBI → settlement CN (full gross) → COM** on Finance approval; `xeroCnId` is stored. `cursorrules` §4 updated to match GEMINI. Webhook-driven `READY` remains correct because the CN exists before payment. See [`cursorrules-current-state.md`](./cursorrules-current-state.md).

2. **RLS policies absent from migrations (cursorrules §2, §9)**  
   **Rule:** RLS policies should exist and, for new tables, live in the same migration.  
   **Repo:** [`supabase/migrations/20260419120000_enable_rls_app_tables.sql`](../../supabase/migrations/20260419120000_enable_rls_app_tables.sql) runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for app tables; **no `CREATE POLICY`** appears in any tracked `.sql` file.  
   **Effect:** PostgREST/anon misuse is still blocked when RLS is on and no policies grant access; the **service role bypasses RLS** anyway, so **tenant isolation depends on application code** (`agencyId` filters, `assertInvoiceTripletInAgency`, etc.), not on database policies.  
   **Risk:** Rules as written are not reproducible from migrations; onboarding a new environment or auditing RLS is harder.

### Medium

3. **Service role usage outside `/app/api` (cursorrules §3)**  
   **`getSupabaseServiceRole`** is imported from many Server Components, server actions, and `src/lib` modules (e.g. finance and agency pages). This does **not** ship the key to the client, but it **conflicts with the literal rule** that restricts the service role to `/app/api` route handlers.  
   **Recommendation:** Amend `cursorrules` to describe the **actual** allowed pattern (server-only, never in client bundles, mandatory `agencyId` / assert helpers), **or** schedule migration toward the user JWT + RLS model the rules describe.

4. **Xero webhook HMAC optional when key missing (production misconfiguration)**  
   In [`src/app/api/webhooks/xero/route.ts`](../../src/app/api/webhooks/xero/route.ts), `verifyXeroSignature` returns `true` if `XERO_WEBHOOK_KEY` / `XERO_WEBHOOK_SIGNING_KEY` is unset, so verification is skipped. A production deploy **without** the key could accept unsigned payloads unless other controls stop it.  
   **Mitigation already present:** In production, invalid signature returns **401** when the key is set; dev can use `XERO_WEBHOOK_ALLOW_INSECURE_DEV`.

5. **VAT threshold monitoring not implemented (cursorrules §7)**  
   [`src/app/(agency)/agency/vat-monitor/page.tsx`](../../src/app/(agency)/agency/vat-monitor/page.tsx) and [`src/app/(finance)/finance/vat-compliance/page.tsx`](../../src/app/(finance)/finance/vat-compliance/page.tsx) are placeholders (“coming soon”). Rolling 12-month logic, tiers (£75k / £85k / £90k), and VAT-registered suppression are **not** implemented in code reviewed.

6. **Input validation: no Zod (cursorrules §10)**  
   Grep shows **no** `zod` usage under `src/`. Server actions use `FormData` and ad-hoc parsing. This diverges from the rule to validate bodies with Zod before touching the database.

7. **Portal access: redirects instead of HTTP 403 (cursorrules §8)**  
   [`src/proxy.ts`](../../src/proxy.ts) redirects users to their role home when they hit another portal; [`resolveFinancePageContext`](../../src/lib/financeAuth.ts) maps some failures to `need_login` rather than a distinct forbidden response. The rule prefers **403** for wrong-role access to a resource; the app favors **redirects** (and `throw` in helpers). Acceptable UX-wise but not literal compliance.

### Low

8. **`console.log` / `console.error` in production paths (cursorrules §11)**  
   Several routes and components use `console.error` / `console.log` (e.g. webhooks, Xero callback, client components on error). The rule prefers a structured logger.

9. **Stripe webhook is a stub**  
   [`src/app/api/webhooks/stripe/route.ts`](../../src/app/api/webhooks/stripe/route.ts) verifies signatures but only logs unhandled events. Aligns with “Connect wired but payouts not yet automated” in `cursorrules` §6, but there is **no** `transfers` implementation or balance gating yet.

---

## Positive alignment (samples)

- **Service role not imported in `'use client'` modules** — `getSupabaseServiceRole` appears in server files; client files use patterns like `console.error` only on the client for errors.  
- **Finance mutations scope by agency** — e.g. [`confirmPayoutRun`](../../src/app/(finance)/finance/payouts/actions.ts) resolves milestones through `dealId` ∈ agency deals; [`assertInvoiceTripletInAgency`](../../src/lib/financeAuth.ts) walks triplet → milestone → deal → `agencyId`.  
- **Talent-facing data** — [`getTalentPortalData`](../../src/lib/talent-portal.ts) exposes `invoiceRef` as INV or OBI number and COM reference; it does **not** surface CN / `ManualCreditNote` to talent summaries reviewed.  
- **Milestone completion math** — [`markMilestoneComplete`](../../src/app/(agency)/agency/pipeline/[id]/actions.ts) runs on the server and branches `SELF_BILLING` vs `ON_BEHALF` for amounts.  
- **Xero webhook** — Uses `req.text()` for HMAC, handles empty body and intent-to-receive, returns 200 for those probes.  
- **Stripe webhook** — Uses `constructEvent` with raw body.

---

## RLS reconciliation (detail)

| Item | Status |
|------|--------|
| RLS enabled on app tables | Yes — see [`20260419120000_enable_rls_app_tables.sql`](../../supabase/migrations/20260419120000_enable_rls_app_tables.sql) |
| `CREATE POLICY` in repo | **None found** |
| Isolation strategy today | Server uses **service role** (bypasses RLS) + **explicit `agencyId` and join checks** in TypeScript |

**Conclusion:** Defense-in-depth for accidental **anon** access to tenant tables is consistent with “RLS on, no policies” for locked-down roles. **Documented `agency_id` RLS policies** in migrations are still missing relative to `cursorrules` §2.

---

## Recommended next steps

1. **ON_BEHALF:** Settlement CN at approval is **implemented**; optional future work: Xero CN **allocation** to OBI at payout per GEMINI.  
2. **Schema/migrations:** Add explicit RLS policies (or document why service-role-only + RLS-off for app role is sufficient) and keep them in `supabase/migrations/`.  
3. **Rules doc:** Reconcile `cursorrules` §3 with **server-only** service role usage, or refactor toward JWT + RLS.  
4. **VAT:** Implement rolling 12-month SBI logic or narrow `cursorrules` §7 until the feature ships.  
5. **API hygiene:** Introduce Zod (or equivalent) for server actions and API routes; consider 403 responses where the rules require them.

---

## PR-specific notes

No open PRs were open at audit time; nothing to list per PR.
