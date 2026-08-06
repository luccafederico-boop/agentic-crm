import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use the Supabase *session* pooler (port 5432) or direct connection for
    // migrations. The transaction pooler (6543) does not support all DDL flows.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
