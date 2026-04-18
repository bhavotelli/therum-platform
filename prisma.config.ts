import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prefer DATABASE_URL; fall back to Vercel Supabase integration (`POSTGRES_PRISMA_URL`).
 * `prisma generate` can run in CI when no URL is set; migrate/deploy need one at runtime.
 */
function resolveDatasourceUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
