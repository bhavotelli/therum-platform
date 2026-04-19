# Supabase RLS vs service role — strategy

## Current model (today)

- **RLS is enabled** on application tables (see [`supabase/migrations/20260419120000_enable_rls_app_tables.sql`](../../supabase/migrations/20260419120000_enable_rls_app_tables.sql)).
- **Policies are defined** in [`supabase/migrations/20260420120000_add_rls_policies.sql`](../../supabase/migrations/20260420120000_add_rls_policies.sql): helpers `get_current_agency_id()`, `get_current_app_user_id()`, `get_current_talent_id()`, `is_agency_staff()`, `deal_visible_to_session(uuid)`, plus per-table policies. **Apply via Supabase CLI or SQL Editor** so your hosted DB matches the repo.
- The Next.js app still uses [`getSupabaseServiceRole`](../../src/lib/supabase/service.ts) for **most** server paths, which **bypasses RLS**. Tenant isolation remains enforced in **TypeScript** until more routes use the session client.

## Code conventions: which client to use

| Path | Client | RLS applies? |
|------|--------|----------------|
| [`/admin`](../../src/app/admin/), [`src/app/admin/actions.ts`](../../src/app/admin/actions.ts), audit/preview queries | **Service role** | No (by design for `SUPER_ADMIN` and bulk admin) |
| Scripts under `scripts/` | **Service role** | No |
| Tenant portals (agency / finance / talent) — **to be migrated gradually** | [`createSupabaseServerClient`](../../src/lib/supabase/server.ts) | **Yes**, once queries use this client |
| **Pilot** | [`GET /api/auth/me`](../../src/app/api/auth/me/route.ts) also loads `agencyFromRls` via the session client to verify RLS allows `Agency` reads for the logged-in user |

**Rule of thumb:** New **tenant-scoped** reads/writes should prefer **`createSupabaseServerClient`** so Postgres enforces policies. Keep **service role** for super-admin operations, backfills, and anything that must see cross-tenant data.

**Auth linkage:** RLS helpers use `"User"."authUserId" = auth.uid()`. Users must have completed Supabase invite (or equivalent) so `authUserId` is set — the Super Admin user list shows **Auth: Linked / Not linked** for visibility.

## Should we move to “RLS enforced” access?

**Yes, as a hardening goal** — RLS adds **defense in depth**: even if one code path forgets an `agencyId` filter, Postgres can still deny the row.

**Trade-offs:**

| Approach | Pros | Cons |
|----------|------|------|
| **Keep service role + app checks** | Simple; matches current code; super-admin / scripts easy | One bug can over-fetch; rules not enforced by DB |
| **User JWT + RLS policies** | DB enforces `agency_id`; safer against query mistakes | Migration cost; every route must use session client or RPC; impersonation needs explicit policy or `SECURITY DEFINER` helpers |
| **Hybrid** | Reads/writes via user client + RLS; **service role** only for cron, migrations, admin bulk jobs | Two patterns to document; clear boundaries required |

## What a migration would require

1. **Policy shape** — e.g. `USING (agency_id = public.current_agency_id())` where `current_agency_id()` reads from `auth.uid()` joined to `User` or from a **JWT claim** (custom claim `agency_id` set at login).
2. **Replace `getSupabaseServiceRole()`** in app paths with [`createSupabaseServerClient`](../../src/lib/supabase/server.ts) (anon key + user cookies) so PostgREST runs **as the signed-in user** and RLS applies.
3. **Super admin / impersonation** — either:
   - short-lived JWT with `agency_id` claim when impersonating, or
   - narrow service-role routes only for admin operations, or
   - `SECURITY DEFINER` SQL functions that validate role before returning rows.
4. **Tests** — policy tests in SQL or integration tests per tenant.

## Recommendation

- **Short term:** Keep the current model; add **explicit RLS policies in migrations** even if the app still uses the service role for a while — documents intent and protects direct Supabase Dashboard / accidental anon misuse.
- **Medium term:** Plan a **phased** move: new tables with policies first; then migrate read paths to the user-scoped client; keep service role for scripts and a shrinking set of server actions.

This is a **multi-sprint** change; it should not block feature work, but it is worth tracking as technical debt with clear ownership.

---

## Review: draft “Claude” RLS migration (would **not** work as pasted)

A common one-shot policy script was reviewed against this repo’s actual schema and auth model. **Do not apply it verbatim** — several policies reference columns that do not exist, and the auth join is wrong for Therum.

### 1. `get_current_agency_id()` must match how login resolves users

The app resolves the app user with **`User.authUserId = auth.uid()`** (see [`resolveAppUserFromSupabaseAuth`](../../src/lib/auth/resolve-app-user.ts)), not `User.id = auth.uid()`. The draft used:

`WHERE id = auth.uid()` — **incorrect** unless your `User.id` is always identical to `auth.users.id` (here they are separate concepts).

Use something like:

`SELECT "agencyId" FROM "User" WHERE "authUserId" = auth.uid()`

(and handle multiple rows / nulls explicitly).

### 2. Tables **without** `agencyId` on the row

Per [`src/types/database.ts`](../../src/types/database.ts):

- **`InvoiceTriplet`** has **no** `agencyId` — a policy `USING ("agencyId" = …)` **will fail** at migration time. Scope via **`Milestone` → `Deal`** (both sides: `Deal.agencyId = get_current_agency_id()` through joins or `EXISTS` subqueries).
- **`Milestone`** has **no** `agencyId` — same fix: join through **`Deal`**.

### 3. `SUPER_ADMIN` and impersonation

If `User.agencyId` is **null** for super admins, `get_current_agency_id()` returns **NULL**, and predicates like `agencyId = NULL` evaluate to **unknown** → **no rows** for RLS. The admin UI would see nothing unless you add **separate policies** (e.g. role claim in JWT, or keep admin paths on **service role** only).

### 4. `TALENT` role vs agency-wide `Talent` rows

A policy “all `Talent` where `agencyId` = current agency” lets a talent user see **every** talent in the agency. Portal rules usually require **only their own** `Talent` row → add something like `id = (SELECT "talentId" FROM "User" WHERE "authUserId" = auth.uid())` for role `TALENT` (often implemented via separate policies or a helper that reads `User.role` — may require `SECURITY DEFINER` helpers because `auth.jwt()` / custom claims are easier than selecting `User` in every policy).

### 5. `Session` / `ResetToken`: `userId` vs `auth.uid()`

If these tables store **app `User.id`**, then `userId = auth.uid()` is **wrong** — use `userId = (SELECT id FROM "User" WHERE "authUserId" = auth.uid())` or equivalent.

### 6. `FOR ALL` and admin-only tables

`DENY ALL` with `USING (false)` on `AdminAuditLog` / `PreviewLog` / `ImpersonationSession` is reasonable for **JWT users**, but remember the **service role bypasses RLS** — server code keeps working as today.

### Bottom line

The **direction** (helper + per-table policies) is fine, but the draft needs a **schema-corrected** version with auth linkage via **`authUserId`**, subqueries for **`Milestone` / `InvoiceTriplet`**, and explicit **super-admin / talent** behavior. Until the app switches from service role to [`createSupabaseServerClient`](../../src/lib/supabase/server.ts) for tenant queries, **policies alone do not change runtime behavior** — they only matter when PostgREST runs as the authenticated user.
