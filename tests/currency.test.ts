import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CachedRate,
  convertToBase,
  getRatesToBase,
  planRateFetch,
  RATE_TTL_MS,
} from "@/lib/currency";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";

const NOW = new Date("2026-08-11T12:00:00Z");

function cachedRate(quote: string, rate: number, ageMs: number): CachedRate {
  return { quote, rate, fetchedAt: new Date(NOW.getTime() - ageMs) };
}

describe("planRateFetch", () => {
  it("serves fresh rates and lists stale/missing quotes", () => {
    const cached = [
      cachedRate("EUR", 0.87, 60_000), // fresh
      cachedRate("BRL", 5.1, RATE_TTL_MS + 1), // stale
    ];
    const { rates, missing } = planRateFetch(
      ["EUR", "BRL", "GBP"],
      cached,
      NOW,
    );
    expect(rates).toEqual({ EUR: 0.87 });
    expect(missing).toEqual(["BRL", "GBP"]);
  });

  it("treats a rate exactly at the TTL boundary as stale", () => {
    const cached = [cachedRate("EUR", 0.87, RATE_TTL_MS)];
    const { missing } = planRateFetch(["EUR"], cached, NOW);
    expect(missing).toEqual(["EUR"]);
  });
});

describe("convertToBase", () => {
  const rates = { EUR: 0.8, BRL: 5.0 };

  it("divides by the quote-per-base rate", () => {
    expect(convertToBase("8000", "EUR", "USD", rates)).toBe(10_000);
    expect(convertToBase(50_000, "BRL", "USD", rates)).toBe(10_000);
  });

  it("is identity for the base currency", () => {
    expect(convertToBase("1234.5", "USD", "USD", rates)).toBe(1234.5);
  });

  it("falls back 1:1 when no rate is known", () => {
    expect(convertToBase(100, "GBP", "USD", rates)).toBe(100);
  });

  it("returns 0 for null/empty/invalid amounts", () => {
    expect(convertToBase(null, "EUR", "USD", rates)).toBe(0);
    expect(convertToBase("", "EUR", "USD", rates)).toBe(0);
    expect(convertToBase("abc", "EUR", "USD", rates)).toBe(0);
  });
});

// Integration: real DB cache, stubbed frankfurter. Uses the fake base "ZZZ"
// so it never collides with real cached rates.
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

suite("getRatesToBase (DB cache + stubbed fetch)", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete(exchangeRates).where(eq(exchangeRates.base, "ZZZ"));
  });

  it("fetches missing rates once, then serves them from the cache", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ base: "ZZZ", rates: { EUR: 0.5, BRL: 4.0 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getRatesToBase("ZZZ", ["EUR", "BRL", "ZZZ"]);
    expect(first).toEqual({ EUR: 0.5, BRL: 4.0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await getRatesToBase("ZZZ", ["EUR", "BRL"]);
    expect(second).toEqual({ EUR: 0.5, BRL: 4.0 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // cache hit, no new request
  });

  it("serves stale cached rates when the API is down", async () => {
    await db.insert(exchangeRates).values({
      base: "ZZZ",
      quote: "EUR",
      rate: "0.75",
      fetchedAt: new Date(Date.now() - RATE_TTL_MS * 2),
    });
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const rates = await getRatesToBase("ZZZ", ["EUR"]);
    expect(rates).toEqual({ EUR: 0.75 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("upserts refreshed rates instead of duplicating rows", async () => {
    await db.insert(exchangeRates).values({
      base: "ZZZ",
      quote: "EUR",
      rate: "0.75",
      fetchedAt: new Date(Date.now() - RATE_TTL_MS * 2),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ base: "ZZZ", rates: { EUR: 0.8 } })),
    );

    const rates = await getRatesToBase("ZZZ", ["EUR"]);
    expect(rates).toEqual({ EUR: 0.8 });

    const rows = await db
      .select()
      .from(exchangeRates)
      .where(
        and(eq(exchangeRates.base, "ZZZ"), eq(exchangeRates.quote, "EUR")),
      );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].rate)).toBe(0.8);
  });
});
