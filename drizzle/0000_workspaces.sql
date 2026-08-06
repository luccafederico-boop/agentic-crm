CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_currency" char(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
-- Defense in depth: all app access goes through the server with the service
-- role (bypasses RLS). Enabling RLS with no policies blocks the anon key.
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
