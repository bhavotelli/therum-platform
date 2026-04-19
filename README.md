This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open the app: local dev [http://localhost:3000](http://localhost:3000), or hosted dev [https://dev.therum.io](https://dev.therum.io).

## Docker (App + Postgres)

Run the full stack with Docker Desktop:

```bash
docker compose up --build
```

Services:
- App: `http://localhost:3001` (default; configurable with `APP_PORT`)
- Postgres: `localhost:5433` (default; configurable with `POSTGRES_PORT`)

Notes:
- Docker runs the app in dev/UAT mode (`next dev`) to avoid build-time DB prerender issues.
- `DATABASE_URL` is set to the internal docker host (`db`) in `docker-compose.yml`.
- In Docker, `NEXTAUTH_URL` / `APP_BASE_URL` default to `http://localhost:3001` (same as `APP_PORT`). For hosted dev, set `NEXTAUTH_URL=https://dev.therum.io` (no path) on the host (e.g. Vercel).
- For external callback/webhook testing (Xero), set `XERO_REDIRECT_URI` and webhook URL to your public dev URL (e.g. `https://dev.therum.io/api/xero/callback`).

Useful commands:

```bash
# Stop stack
docker compose down

# Stop and remove database volume (fresh DB)
docker compose down -v
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Email (invite + password reset)

Super Admin invite, resend, and admin-initiated password reset are sent **by Supabase Auth** (`inviteUserByEmail` / `resetPasswordForEmail`). Use the hosted project’s default mail, or add optional **custom SMTP only in** the Supabase Dashboard (**Authentication → SMTP**). This app does not use SendGrid, nodemailer, or app-level `SMTP_*` variables.

Set **`NEXT_PUBLIC_APP_ORIGIN`** (e.g. `https://dev.therum.io`) so invite/recovery links in email use your real domain, not a Vercel preview host. Also set **`NEXTAUTH_URL`** / **`APP_BASE_URL`** as needed — see [`docs/onboarding-auth-supabase-alignment.md`](docs/onboarding-auth-supabase-alignment.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
