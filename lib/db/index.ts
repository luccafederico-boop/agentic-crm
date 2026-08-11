import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }
  // Runtime MUST use the transaction pooler (port 6543): the session pooler
  // has a small client cap and serverless lambdas exhausted it in production
  // (EMAXCONNSESSION). prepare: false is required in transaction mode. Keep
  // per-instance connections low — the pooler multiplexes server-side.
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
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
