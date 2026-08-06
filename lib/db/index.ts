import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }
  // prepare: false is required for the Supabase transaction pooler (port 6543).
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

// Lazy singleton: nothing connects (or throws) at import time, so the app
// builds without env vars. Cached on globalThis so dev hot reloads don't
// exhaust pooler connections.
const globalForDb = globalThis as unknown as { db?: Db };

function getDb(): Db {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = getDb()[prop as keyof Db];
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});
