import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";

// ECB publishes reference rates once per working day.
export const RATE_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedRate = {
  quote: string;
  rate: string | number;
  fetchedAt: Date;
};

// Split cached rows into still-fresh rates and quotes that need a fetch.
export function planRateFetch(
  quotes: string[],
  cached: CachedRate[],
  now: Date,
  ttlMs = RATE_TTL_MS,
): { rates: Record<string, number>; missing: string[] } {
  const rates: Record<string, number> = {};
  const missing: string[] = [];
  for (const quote of quotes) {
    const row = cached.find((r) => r.quote === quote);
    if (row && now.getTime() - row.fetchedAt.getTime() < ttlMs) {
      rates[quote] = Number(row.rate);
    } else {
      missing.push(quote);
    }
  }
  return { rates, missing };
}

// rate = units of `currency` per 1 base, so converting to base divides.
// A currency with no rate (never fetched AND the API is down) counts 1:1
// rather than silently vanishing from totals.
export function convertToBase(
  amount: string | number | null | undefined,
  currency: string,
  base: string,
  rates: Record<string, number>,
): number {
  const value = Number(amount ?? 0);
  if (!value || Number.isNaN(value)) return 0;
  if (currency === base) return value;
  const rate = rates[currency];
  if (!rate) return value;
  return value / rate;
}

// Lazy cached lookup: serve rates fresher than the TTL from exchange_rates,
// fetch the rest from frankfurter.app in a single call and upsert them, and
// fall back to stale cached rates if the API is unreachable.
export async function getRatesToBase(
  base: string,
  quotes: Iterable<string>,
): Promise<Record<string, number>> {
  const needed = [...new Set(quotes)].filter((q) => q !== base);
  if (needed.length === 0) return {};

  const cached = await db
    .select({
      quote: exchangeRates.quote,
      rate: exchangeRates.rate,
      fetchedAt: exchangeRates.fetchedAt,
    })
    .from(exchangeRates)
    .where(
      and(eq(exchangeRates.base, base), inArray(exchangeRates.quote, needed)),
    );

  const { rates, missing } = planRateFetch(needed, cached, new Date());
  if (missing.length === 0) return rates;

  try {
    const url = `${FRANKFURTER_URL}?base=${base}&symbols=${missing.join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`frankfurter responded ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const fetchedAt = new Date();
    const rows = Object.entries(data.rates ?? {}).map(([quote, rate]) => ({
      base,
      quote,
      rate: String(rate),
      fetchedAt,
    }));
    if (rows.length > 0) {
      await db
        .insert(exchangeRates)
        .values(rows)
        .onConflictDoUpdate({
          target: [exchangeRates.base, exchangeRates.quote],
          set: {
            rate: sql`excluded.rate`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        });
      for (const row of rows) rates[row.quote] = Number(row.rate);
    }
  } catch (err) {
    console.warn("[currency] rate fetch failed, serving stale rates:", err);
  }

  // Anything still missing (API down or symbol not returned): serve the stale
  // cached rate if one exists; otherwise convertToBase falls back to 1:1.
  for (const quote of missing) {
    if (rates[quote] !== undefined) continue;
    const stale = cached.find((r) => r.quote === quote);
    if (stale) rates[quote] = Number(stale.rate);
  }
  return rates;
}
