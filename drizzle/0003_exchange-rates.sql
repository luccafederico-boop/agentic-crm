CREATE TABLE "exchange_rates" (
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_base_quote_pk" PRIMARY KEY("base","quote")
);
--> statement-breakpoint
-- Hand-appended: same posture as every other table — no PostgREST access
-- (the app reads via Drizzle as the table owner, which bypasses RLS).
ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;
