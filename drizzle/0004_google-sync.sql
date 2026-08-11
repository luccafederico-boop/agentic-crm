CREATE TABLE "google_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"scopes" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_error" text,
	CONSTRAINT "google_accounts_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_external_idx" ON "activities" USING btree ("workspace_id","external_id") WHERE "activities"."external_id" is not null;--> statement-breakpoint
-- Hand-appended: same posture as every other table — no PostgREST access
-- (the app reads via Drizzle as the table owner, which bypasses RLS).
ALTER TABLE "google_accounts" ENABLE ROW LEVEL SECURITY;