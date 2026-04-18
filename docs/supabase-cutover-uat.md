# Supabase DB + Auth cutover — UAT & release checklist

## Pre-deploy (staging)

1. **Env**: `DATABASE_URL` (pooler), `DIRECT_URL` (direct Postgres), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`), beta flags if used.
2. **Schema**: `npx prisma migrate deploy`
3. **Backfill**: run `npx tsx scripts/backfill-supabase-auth-user-ids.ts` after Auth users exist for each app user (same email as `User.email`).
4. **Smoke**: cold load `/login` → sign in → gate cookie set → redirected to correct portal.

## Multi-agency UAT (at least two agencies)

| Area | Check |
|------|--------|
| Login / logout | Session clears; cannot access portals without gate + Supabase session |
| SUPER_ADMIN | Impersonation cookie + admin + agency/finance preview |
| FINANCE | Invoices, payouts export, Xero callback (if used) scoped to impersonation or agency |
| AGENCY | Pipeline, talent roster, clients — tenant isolation |
| TALENT | Dashboard + beta notice if `THERUM_BETA_PREVIEW_ONLY` |
| Admin | User/agency admin only for `SUPER_ADMIN` |

## Production cutover

1. Maintenance window or accept brief login downtime.
2. Deploy app + env (Supabase URLs/keys).
3. Run migrations + backfill script (Auth users must already exist or be imported before backfill).
4. Smoke test: login per role, Xero token callback, finance export routes.
5. Monitor logs for mapping failures (`resolveAppUser` / `establish-session` 403).

## Rollback

- Revert deployment to previous build still on local/legacy auth (only if dual config kept — not the default for this cutover).
- Keep `User` rows; `authUserId` is optional and safe to leave populated.
