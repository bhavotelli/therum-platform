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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
- `NEXTAUTH_URL` defaults to `http://localhost:3000` (update to your external dev URL when tunnelling/public).
- For external callback/webhook testing (Xero), set `XERO_REDIRECT_URI` and webhook URL to your public dev URL.

Useful commands:

```bash
# Stop stack
docker compose down

# Stop and remove database volume (fresh DB)
docker compose down -v
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Email Setup (Invite + Password Reset)

Super Admin invite/reset actions now send real emails when SMTP is configured.

Add these to your `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
MAIL_FROM=Therum <no-reply@therum.co>
APP_BASE_URL=http://localhost:3000
# Optional (recommended for SendGrid): exact verified sender email
SENDGRID_VERIFIED_SENDER=you@verified-domain.com
```

Notes:
- `SMTP_PORT=465` uses secure SMTP automatically.
- If SMTP vars are missing, the app falls back to logging email payloads to server console for local testing.
- `APP_BASE_URL` (or `NEXTAUTH_URL`) is used to build invite/reset links in emails.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
