# RFC 001 — Service-role vs RLS-authenticated server-side reads

**Status:** Draft — awaiting review
**Author:** Bhav
**Ticket:** [THE-78](https://linear.app/therum/issue/THE-78)
**Date:** 2026-04-22

---

## TL;DR

Every server-side data path in the app uses the Supabase service role and
bypasses RLS. Multi-tenancy isolation is enforced at the application layer
via `.eq('agencyId', contextAgencyId)` after resolving the session. RLS
policies exist on every major table today but are dormant for reads.

**Recommendation: Do not migrate now. Revisit in 6–12 months.**

The existing app-layer pattern is consistent, the cost of migrating is
substantial (50 files for reads, plus a non-trivial refactor of writes and
impersonation), and the marginal security win doesn't justify it at this
team size. A small proof-of-concept would de-risk a future migration but
this ticket treats the investigation itself as the deliverable.

---

## 1. Current state

### 1.1 Service-role everywhere

`rg -l "getSupabaseServiceRole" src/` returns **50 files**. Every server
component, server action, API route, and background script runs against the
service role and joins on `agencyId` manually.

Pattern you'll see repeated:

```ts
const db = getSupabaseServiceRole()
const { data } = await db
  .from('Deal')
  .select('*')
  .eq('agencyId', context.agencyId) // <-- tenancy boundary, enforced in-code
```

This works — it's been the convention from the start of the app — but the
tenancy boundary is a line of code the author has to remember. There's no
DB-level backstop. A forgotten `.eq('agencyId', ...)` on a new route is
the kind of mistake that doesn't fail any tests we have.

### 1.2 RLS policies already exist, but are unused for reads

`supabase/migrations/20260420120000_add_rls_policies.sql` (~91 policies
across tables) already enables RLS on:

- Agency, Client, ClientContact, Talent, Deal, Milestone, Deliverable,
  InvoiceTriplet, ManualCreditNote, DealExpense, ChaseNote, User,
  AdminAuditLog, ImpersonationSession, PreviewLog, Session, ResetToken

And defines these SECURITY DEFINER helpers:

- `public.get_current_agency_id()` — resolves `auth.uid()` → User.agencyId
- `public.get_current_app_user_id()` — `auth.uid()` → User.id
- `public.get_current_talent_id()` — `auth.uid()` → User.talentId (TALENT role only)
- `public.is_agency_staff()` — role in `('AGENCY_ADMIN', 'AGENT', 'FINANCE')`
- `public.deal_visible_to_session(did uuid)` — row-level check chaining
  through `Deal.agencyId` or through `Talent.id = get_current_talent_id()`

So the RLS layer is built. It's just bypassed by the service role in every
server-side read path.

### 1.3 Middleware already uses RLS-authenticated client

`src/proxy.ts` creates `createServerClient(NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, { cookies })`
to call `supabase.auth.getUser()`. The pattern for using the anon key +
user JWT is already established — it's just limited to auth resolution,
not data reads.

### 1.4 Impersonation

Super-admin impersonation works via the `therum_impersonation` cookie
(`src/lib/impersonation.ts`). Server-side code reads it, swaps the
effective `agencyId`, and queries with that. No DB-level awareness — the
service role doesn't care about the cookie.

### 1.5 Writes go through SECURITY DEFINER RPC functions

Critical writes (invoice approval, Xero push, atomic multi-step operations)
live in DB RPC functions — e.g. `complete_xero_push` in migration
`20260421170000_complete_xero_push.sql` — marked `SECURITY DEFINER`. These
assume the service role caller has already done the auth check.

Migrating writes to RLS-authenticated isn't just swapping the client; it
means rethinking the SECURITY DEFINER boundary and whether the RPC
functions trust `auth.uid()` instead of a caller-provided `userId`.

---

## 2. A minimal proof-of-concept

Picking a low-risk read route to migrate as POC: **`/finance/invoices`**
(the invoice queue page). It's a pure read path, the tenancy filter is
agency-level, and it's exercised frequently in dev so we'd notice
regressions quickly.

### 2.1 Changes required (reads only)

```ts
// Before:
const db = getSupabaseServiceRole()
const { data: deals } = await db.from('Deal').select('*').eq('agencyId', agencyId)

// After:
const db = await createRlsServerClient()  // <— new helper using @supabase/ssr
const { data: deals } = await db.from('Deal').select('*')
// No .eq — the deal_staff_read RLS policy filters to the user's agency
```

Where `createRlsServerClient()` wraps `createServerClient()` with a cookie
reader that forwards the request's auth cookies. This is already how
`src/proxy.ts` works; we'd extract it to a server-component-safe helper.

### 2.2 Changes required (writes, for completeness)

Server actions that insert/update would need:

1. An RLS-authenticated client (same helper as reads).
2. RLS `INSERT` / `UPDATE` policies on every target table — most already
   have `staff_write` / `staff_update` but some gaps likely exist.
3. Any code that calls a SECURITY DEFINER RPC keeps using the service role
   OR we rewrite the RPC to accept the user's JWT context.

### 2.3 Observability to add during the POC

- Log the effective `get_current_agency_id()` for each request that hits the
  migrated route. Confirms RLS is actually applying.
- Compare query timings (Vercel Speed Insights or `Server-Timing`
  headers) — measure p50 and p95 before/after.
- Watch for 42501 (insufficient privilege) Postgres errors in Sentry —
  indicates missing policies.

---

## 3. Perf impact (estimated)

No live measurements taken (no access to a deployed instance from the
investigation). Estimates based on Supabase docs + PostgREST behaviour:

| Cost | Estimate | Notes |
|---|---|---|
| JWT verify per request | +1-3ms | Supabase does this once per request; same as middleware today |
| `SECURITY DEFINER` helper calls | +<1ms each | Indexed lookups on `User.authUserId` |
| RLS policy evaluation | Negligible for simple policies | Our `USING (agencyId = get_current_agency_id())` resolves in the same query plan |
| Complex RLS (`deal_visible_to_session`) | +2-5ms | Subquery into Deal table; would benefit from an index on `(agencyId, id)` which already exists |
| Net cold-request overhead | **+5-10ms** | Dominated by JWT verification |
| Net warm-request overhead | **~0ms** | JWT verify result cached per request; policies are inlined |

For an invoice queue page that already takes 200-500ms due to the query
fanout, the added latency is not user-visible.

**Gotcha:** the service role can batch-read across tenants (e.g. super
admin's admin dashboard). With RLS on, cross-tenant reads need an explicit
escalation — either keep service role for those specific paths, or use a
SECURITY DEFINER function with explicit checks.

---

## 4. Impersonation under RLS

Current: super admin's `agencyId` is `null`; app code reads the
`therum_impersonation` cookie and swaps `agencyId` to the impersonated
tenant's ID for the request. Service role bypasses RLS so no DB-level
challenge.

Under RLS, three options:

### Option A: Hybrid — keep service role for impersonation only

Impersonation stays on service role. Regular user reads use RLS. Simple,
preserves today's semantics. Weakness: the impersonation path is the one
that would most benefit from a DB-level backstop (because the super admin
is acting as someone else).

### Option B: Custom JWT claim + policy update

Set a `impersonating_agency_id` claim in the JWT when impersonation
starts. Update `get_current_agency_id()` to check for that claim and
return it if present, else fall through to `User.agencyId`.

```sql
-- Example update
CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'impersonating_agency_id')::uuid,
    (SELECT u."agencyId" FROM public."User" u WHERE u."authUserId" = auth.uid() LIMIT 1)
  );
$$;
```

Clean, all context lives in the JWT, no hybrid. Requires re-issuing the
JWT on every impersonation start/stop — not trivial with Supabase.

### Option C: Postgres `SET LOCAL` per request

Server-side action sets a transaction-local config var, RLS helpers read
from it. Works cleanly per-request but adds a round-trip and requires
transaction management every request. Not recommended.

**Recommendation for impersonation:** Option A (hybrid) if we migrate.
Option B is cleaner long-term but the JWT re-issue complexity is
significant for a feature used by one user (the founder, today).

---

## 5. Effort estimate

| Scope | Files / LoC | Effort |
|---|---|---|
| **Reads POC** — `/finance/invoices` route only | ~3-5 files (page + loaders + helper) | ~1 day |
| **All reads** — 50 files | ~50 files, mostly mechanical | ~3-5 days |
| **Impersonation** under Option A | +helper for agency context switch | ~0.5 day |
| **Writes** — pipeline + finance actions | 20-30 action files, some RPC rework | ~5-10 days |
| **RPC functions** — re-auth to use `auth.uid()` | 5-7 SECURITY DEFINER fns | ~2-3 days |
| **Test / observability / rollback plan** | — | ~2 days |
| **Total** | — | **~3-4 weeks of focused work** |

Rollback is possible per-route (keep a feature flag + a service-role
fallback path) but doubles the surface area during the migration.

---

## 6. What we gain

- **Defence in depth.** DB won't return cross-tenant data even if a dev
  forgets the `.eq('agencyId', ...)` filter. Real value when team grows
  past one person.
- **Reviewer confidence.** Claude PR review (and any future human
  reviewer) stops needing to audit every new `.from('...')` call for
  tenancy filters.
- **Audit log fidelity.** `auth.uid()` is available in the DB, so
  triggers can record "user X modified row Y" natively rather than
  relying on app-layer `actorUserId` passthrough.
- **Future multi-role features.** The RLS policy pattern already supports
  "TALENT sees their own data" via `get_current_talent_id()` — if we
  add more role-specific read paths this pays off faster.

## 7. What we pay

- **3-4 weeks of engineering time** that could go to features or other
  debt.
- **Debugging cost increase.** When something doesn't return, is it a
  missing RLS policy, a missing filter, a claim issue, or an actual data
  problem? More layers to check.
- **Impersonation complexity.** Option A (hybrid) keeps service role for
  this path, meaning two patterns to maintain instead of one.
- **Write-path rework.** RPC functions either stay `SECURITY DEFINER`
  with service-role assumption or get rethought. The former is a
  compromise on purity; the latter is real work.
- **Migration risk.** Any route we migrate incorrectly becomes a
  403/empty-result bug that isn't caught by type checks.

---

## 8. Go / No-go

**No-go, for now.**

The current pattern is consistent, the team is small, and the marginal
safety win doesn't justify 3-4 weeks of work plus ongoing complexity.
Features and visible UX work deliver more value per engineer-week today.

### When to revisit

Trigger any of the following and this ticket should come back:

1. **Second engineer joins.** With two or more devs, the probability of
   forgetting `.eq('agencyId', ...)` in a new route goes up, and
   reviewer fatigue sets in.
2. **Role-split features land.** If we add "Talent sees their own
   contracts" or "Client portal" pages, RLS naturally fits those
   patterns better than app-layer filters.
3. **A real cross-tenant bug ships.** Any production incident where
   agency A saw agency B's data is immediate grounds to migrate,
   regardless of the other triggers.
4. **Compliance pressure.** If a future enterprise customer or audit
   requires DB-level tenant isolation evidence, the service-role story
   becomes harder to defend.

### What to do in the meantime

- **Keep the current app-layer discipline tight.** Every `.from('...')`
  call on a cross-tenant table should have a visible `.eq('agencyId',
  ...)` within ~10 lines. Make that a review rubric.
- **Don't let RLS policies drift.** They're already defined — if a new
  table is added for tenant data, add its policy in the same migration.
  Dormant policies that don't match current columns would be noisy to
  migrate later.
- **Log tenant ID on every server-action audit event** (already the case
  for most — confirm no gaps). This gives forensics if a breach ever
  happens.
- **Document the pattern.** Add a one-paragraph "multi-tenancy: app-layer
  filtering" section to `AGENTS.md` so new contributors see the rule
  up-front rather than discovering it by osmosis.

---

## 9. Appendices

### 9.1 Service-role consumer inventory (50 files)

Major concentrations:

- `src/lib/finance/*` — dashboard, invoice-queue, deals page data loaders
- `src/lib/xero-*` — Xero sync + contact sync
- `src/lib/talent-portal.ts` — talent portal data
- `src/lib/agencyAuth.ts`, `src/lib/financeAuth.ts`, `src/lib/auth/*` —
  auth context resolution (these would stay on service role, used at
  session-establishment time, not per-read)
- `src/app/**/actions.ts` — server actions across pipeline, finance, admin
- `src/app/api/*` — API routes (Xero webhook, auth handshake)

Full list via `rg -l "getSupabaseServiceRole" src/`.

### 9.2 RPC functions using SECURITY DEFINER

- `complete_xero_push` — atomic invoice-triplet approval (THE-48)
- `atomic_multi_step_*` — various atomic operations (5 fns, THE-56)
- `get_current_agency_id`, `get_current_app_user_id`,
  `get_current_talent_id`, `is_agency_staff`, `deal_visible_to_session`
  — RLS helpers, safe to keep as-is under migration

### 9.3 Further reading

- Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
- `supabase/migrations/20260419120000_enable_rls_app_tables.sql` — RLS
  enablement + FORCE RLS on every app table
- `supabase/migrations/20260420120000_add_rls_policies.sql` — actual
  policies (the bit that's dormant today)
