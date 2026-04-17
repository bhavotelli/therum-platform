import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Use process.env.DATABASE_URL — not prisma/config `env()` — so `prisma generate`
 * can run in CI (e.g. Vercel `npm install`) when DATABASE_URL is not injected yet.
 * Commands that touch the DB (migrate, db push, studio) still require DATABASE_URL at runtime.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
