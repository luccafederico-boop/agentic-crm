import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations prefer the *session* pooler (port 5432); the app runtime uses
    // the transaction pooler (6543) via DATABASE_URL. In CI both are the same
    // plain Postgres, so the fallback covers it.
    url: process.env.DATABASE_URL_SESSION ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
