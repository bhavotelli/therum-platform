import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getDatabaseUrlOptional } from "./src/lib/database-url";

/**
 * Prefer DATABASE_URL; fall back to Vercel Supabase integration (`POSTGRES_PRISMA_URL`).
 * URLs are normalized for Supabase pooler (6543) — see `src/lib/database-url.ts`.
 */
function resolveDatasourceUrl(): string | undefined {
  return getDatabaseUrlOptional();
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
