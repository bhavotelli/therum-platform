# Onboarding / auth: BETA alignment and Supabase email

This document is the implementation of the onboarding/auth audit: spike results against `@supabase/auth-js` (via `supabase-js` **v2.103.x**), a **chosen strategy** for evolving mail + UX, and a **backlog** aligned with [BETA.md](../BETA.md) (product spec).

## Current architecture (today)

```mermaid
flowchart LR
  subgraph goTrueMail [Supabase Auth–sent email]
    I[auth.admin.inviteUserByEmail]
    R[resetPasswordForEmail anon + implicit]
    MailOut[Default project mail or optional Dashboard SMTP]
    I --> MailOut
    R --> MailOut
  end
  subgraph tokens [Legacy app-layer tokens]
    C[User.inviteToken + inviteExpiry]
    D[ResetToken — unused for new admin resets]
  end
  subgraph supa [Supabase Auth]
    E[createUser / updateUser]
    F[Browser session + establish-session]
  end
  goTrueMail -->|Super Admin invite + resend + admin reset| UserMail[User inbox]
  tokens -->|old links only| G[/auth/set-password]
  G -->|sets password| E
  I -->|redirectTo| CB[/auth/callback]
  R -->|redirectTo| REC[/reset-password]
  CB --> F
  REC -->|updateUser password| F
  F --> AppUser[App User row + gate cookie]
```

| Responsibility | Where it lives |
|----------------|----------------|
| **Super Admin** invite, resend invite, admin password reset **delivery** | GoTrue: [`inviteUserByEmail`](../src/lib/supabase/gotrue-mail.ts), [`resetPasswordForEmail`](../src/lib/supabase/gotrue-mail.ts). Supabase sends the message (built-in mail by default; optional custom SMTP **only** under **Supabase Dashboard → Authentication → SMTP** — not in this app’s `.env`). |
| New-user **redirect** after invite | [`/auth/callback`](../src/app/auth/callback/page.tsx) uses [`createSupabaseImplicitClient`](../src/lib/supabase/client.ts) (same as reset mail — URL hash tokens), then [`/api/auth/establish-session`](../src/app/api/auth/establish-session/route.ts) → role home. |
| Password reset **completion** after email link | [`/reset-password`](../src/app/reset-password/page.tsx) ([`PasswordResetForm`](../src/components/auth/PasswordResetForm.tsx)) → establish-session. [`/auth/recovery`](../src/app/auth/recovery/page.tsx) redirects here. |
| Legacy **token** links (still valid for old emails) | [`User.inviteToken`](../src/types/database.ts), [`ResetToken`](../src/types/database.ts) → [`/auth/set-password`](../src/app/auth/set-password/page.tsx) → [`setSupabaseAuthPasswordById`](../src/lib/supabase/admin.ts) |
| Login session | [`src/app/login/page.tsx`](../src/app/login/page.tsx) → establish-session |

---

## Spike: `@supabase/auth-js` — send vs generate

Source: `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts` and `GoTrueClient.ts` (project version **2.103.x**).

| API | Sends email from Supabase Auth? | Notes |
|-----|--------------------------------|--------|
| `auth.admin.inviteUserByEmail(email, { redirectTo?, data? })` | **Yes** | JSDoc: “Sends an invite link to an email address.” Uses `POST /invite`. PKCE **not** supported for this flow. |
| `auth.admin.generateLink({ type, email, ... })` | **No** | JSDoc: generates links/OTPs “to be sent **via a custom email provider**”. Returns `data.properties.action_link` (and related fields). Types include `signup`, `magiclink`, `invite`, `recovery`, etc. |
| `auth.resetPasswordForEmail(email, { redirectTo?, captchaToken? })` | **Yes** | JSDoc: “only **sends** a password reset link”. Uses `POST /recover`; supports **PKCE** when client `flowType === 'pkce'`. Intended for the user-driven recovery path. |
| `auth.admin.createUser(...)` | **No** (unless using invite path) | JSDoc: does **not** send confirmation email; use `inviteUserByEmail` if you want Auth to email. |

**Implication:** To have **Supabase** deliver the message (built-in mail or SMTP configured in the project dashboard), you must call an API that **triggers** GoTrue to send mail (`inviteUserByEmail`, `resetPasswordForEmail`), not `generateLink` alone—unless you send `action_link` yourself (separate custom mail path).

**Service role:** `resetPasswordForEmail` exists on the shared `GoTrueClient` (not only `admin`). Server code may call it with a server-only client **if** your security model allows (same project URL); verify in staging that `/recover` accepts the key you use (anon vs service role)—policies can differ; use **anon** from a Route Handler if service role is rejected.

### Redirect URLs and PKCE recovery

- `resetPasswordForEmail` accepts `redirectTo`; that URL must appear under **Authentication → URL configuration → Redirect URLs** in the Supabase project (wildcards per [Supabase redirect docs](https://supabase.com/docs/guides/auth/redirect-urls)).
- PKCE recovery stores a code challenge in the client **storage** configured on the Supabase client. Server-only calls without a browser session need careful testing; the **documented** pattern is often **browser-initiated** reset (`resetPasswordForEmail` from the client) then `updateUser({ password })` on the page users land on after the link.

---

## Chosen strategy (decision)

### Done — Super Admin onboarding mail via GoTrue

[`src/app/admin/actions.ts`](../src/app/admin/actions.ts) uses [`gotrue-mail.ts`](../src/lib/supabase/gotrue-mail.ts): `createAgency`, `addAgencyUser`, `resendInvite`, and `resetUserPassword` send email through **Supabase Auth only** (no app SMTP). Redirect targets are allowlisted in the project (**Redirect URLs**): public app origin + `/auth/callback` (invites) and `/reset-password` (resets; include `/auth/recovery` too if old links exist). [`getPublicAppOrigin`](../src/lib/app-url.ts) prefers **`NEXT_PUBLIC_APP_ORIGIN`** so links use your real domain, not a preview `*.vercel.app` host. See [`getInviteRedirectForRole` / `getRecoveryRedirectForRole`](../src/lib/supabase/gotrue-mail.ts).

### Done — Self-service Forgot password on `/login`

Shipped under THE-93. `/login` now shows a `Forgot?` link next to the password label, routing to [`/forgot-password`](../src/app/forgot-password/page.tsx) ([`ForgotPasswordForm`](../src/components/auth/ForgotPasswordForm.tsx)). The form calls `resetPasswordForEmail` from the browser (anon + implicit), surfaces friendly rate-limit messaging, and enforces a 60s client-side cooldown. The route is allowlisted in [`src/proxy.ts`](../src/proxy.ts) so unauthenticated users actually reach it. Custom SMTP (Resend, port 587 STARTTLS) is configured in **Supabase Dashboard → Authentication → SMTP** to lift the default rate limit.

### Legacy `/auth/set-password` + tokens

Older **inviteToken** / **ResetToken** links still land on [`/auth/set-password`](../src/app/auth/set-password/page.tsx) until those tokens expire or users are re-invited through GoTrue.

---

## Environment checklist — who sends what

| Variable / setting | Role |
|--------------------|------|
| **Supabase project** (default mail, or **Dashboard → Authentication → SMTP** if you add a provider) | Delivers **Super Admin** invite, resend, and admin password-reset mail (`inviteUserByEmail`, `resetPasswordForEmail`). No SMTP keys in the Next.js app. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server recovery sender + browser Auth (`resetPasswordForEmail` uses anon in [`gotrue-mail.ts`](../src/lib/supabase/gotrue-mail.ts)). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; DB + [`inviteUserByEmail`](../src/lib/supabase/gotrue-mail.ts). |
| **Redirect URLs** (same Supabase project) | Must include your app’s `/auth/callback` and `/reset-password` (and `/auth/recovery` for legacy). Local dev: `http://localhost:3000/...`. Built from [`getPublicAppOrigin`](../src/lib/app-url.ts) — set **`NEXT_PUBLIC_APP_ORIGIN`** (or `NEXTAUTH_URL` / `APP_BASE_URL`) to the URL users open in the browser. |

Avoid pointing `DATABASE_URL` at a **different** Postgres project than Auth—the cutover doc already warns about this: [docs/supabase-cutover-uat.md](./supabase-cutover-uat.md).

---

## Password integrity — per-portal user-creation paths (THE-94 audit)

For each portal, the row says *how* a user account is provisioned and which mechanism guarantees the resulting Supabase Auth row has a real bcrypt-hashed password before login becomes possible. None of the paths below ever stores a plaintext password; Supabase Auth handles bcrypt internally on `createUser` / `updateUser` / `inviteUserByEmail`.

| Portal | How users are created | Password set by | First-login gate |
|---|---|---|---|
| **Admin (Super Admin)** | Bootstrapped via dev seed only (synthetic `superadmin@therum.local`) | Seed sets `DEV_PASSWORD` via `setSupabaseAuthPasswordById` | Dev-only — guarded by domain allowlist in [`provisionDevAuthUser`](../scripts/seed.ts) and `NODE_ENV=production` refusal |
| **Agency (Admin / Agent / Finance)** | Super Admin invites via [`createAgency`](../src/app/admin/actions.ts) and [`addAgencyUser`](../src/app/admin/actions.ts) | User sets it themselves through the GoTrue invite email → `/auth/callback` → `updateUser({ password })` | Auth user has no password until invite is completed; `inviteUserByEmail` does not return a session |
| **Talent (when enabled)** | Currently **not implemented** — [`createTalent`](../src/app/(agency)/agency/talent-roster/actions.ts) inserts a `Talent` row but does not invite a Supabase Auth user. Talent login is disabled in beta via `THERUM_BETA_PREVIEW_ONLY` (see [`resolve-app-user.ts`](../src/lib/auth/resolve-app-user.ts)) | n/a today | Tracked separately — invite path must land before talent portal access can be enabled |
| **Self-signup** | Disabled; no `signUp()` call site exists in the app | n/a | n/a |

Session validation across all portals goes through `supabase.auth.getUser()` (server round-trip, not just `getSession()` cookie read), and every server-side guard (`requireSuperAdmin`, `getAgencySessionContext`, `resolveFinancePageContext`, `resolveAppUser`) is downstream of that check. RLS in [`supabase/migrations/20260420120000_add_rls_policies.sql`](../supabase/migrations/20260420120000_add_rls_policies.sql) routes every tenant policy through `auth.uid()` via a `User.authUserId` lookup; admin-only tables (`AdminAuditLog`, `ImpersonationSession`) explicitly `USING (false)` for authenticated callers, forcing service-role-only access.

### Dev seed safety (while dev and prod share one Supabase project)

The current single Supabase project means a `npm run seed` run from a developer's laptop writes to the same Supabase that production reads from. Two safeguards in [`scripts/seed.ts`](../scripts/seed.ts) try to make this less dangerous:

1. **`NODE_ENV=production` refusal** — the script throws on import if `NODE_ENV=production`. This protects against running the script from a prod-style shell, but does **not** detect that the Supabase project itself is shared with prod.
2. **Throwaway-domain allowlist** — `provisionDevAuthUser` will only set a password for emails ending in `@therum.local`, `@testagency.com`, or `@tidalstudios.com`. Any other email (e.g. a real `@therum.io` super admin) throws before touching `auth.users`. This is what stops the seed from silently overwriting a real user's password.

Filing a separate ticket for proper environment separation (a dedicated dev Supabase project) remains the right long-term fix; the guards above are a holding pattern.

## BETA.md backlog (implementation gaps)

These are **product** gaps vs the HTML spec [BETA.md](../BETA.md), separate from the Super Admin GoTrue mail cutover above.

| Item | BETA expectation | Code / note |
|------|----------------|-------------|
| Agency **Settings → Team** invites | Agency Admin invites agents/finance | **Not found** under `src/app/(agency)`; only Super Admin [`addAgencyUser`](../src/app/admin/actions.ts) / [`resendInvite`](../src/app/admin/actions.ts). |
| Talent **portal invite on first enable** | Invite email when portal enabled | [`createTalent`](../src/app/(agency)/agency/talent-roster/actions.ts) inserts [`Talent`](../src/types/database.ts) only; no [`User`](../src/types/database.ts) + invite path. |

---

## Supabase-hosted auth email (default vs optional SMTP)

**Super Admin** onboarding email is sent **only** by Supabase Auth when **`inviteUserByEmail`** / **`resetPasswordForEmail`** runs. You can rely on **Supabase’s built-in mail** (subject to [project rate limits](https://supabase.com/docs/guides/auth/auth-smtp)) or add **optional custom SMTP** in **Supabase Dashboard → Authentication → SMTP** (your own provider, configured there — not in this repository’s environment).

### Custom SMTP: link tracking can break auth URLs

If you use a third-party SMTP in the dashboard, some providers wrap links for click analytics. **Long magic links** (recovery, invite) can fail if tracking alters or truncates URLs. In that provider’s console, disable **click tracking** / link wrapping for transactional auth, then resend a test email and confirm the reset link opens your app’s `/reset-password` (or your Supabase verify redirect) unchanged.

---

## References

- Supabase JS bundled types: `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts`, `GoTrueClient.ts`
- Internal cutover checklist: [docs/supabase-cutover-uat.md](./supabase-cutover-uat.md)
