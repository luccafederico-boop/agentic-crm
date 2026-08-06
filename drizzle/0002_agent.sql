CREATE TYPE "public"."agent_lane" AS ENUM('visible', 'research');--> statement-breakpoint
CREATE TYPE "public"."agent_task_status" AS ENUM('queued', 'running', 'done', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."fact_band" AS ENUM('verified', 'probable', 'possible');--> statement-breakpoint
CREATE TYPE "public"."fact_status" AS ENUM('applied', 'proposed', 'dismissed', 'superseded');--> statement-breakpoint
CREATE TABLE "agent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lane" "agent_lane" DEFAULT 'research' NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"budget" integer DEFAULT 15 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"status" "agent_task_status" DEFAULT 'queued' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contact_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"band" "fact_band" NOT NULL,
	"status" "fact_status" NOT NULL,
	"method" text,
	"source_url" text,
	"evidence" jsonb NOT NULL,
	"task_id" uuid,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_facts" ADD CONSTRAINT "contact_facts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_facts" ADD CONSTRAINT "contact_facts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_events_task_idx" ON "agent_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "agent_messages_subject_idx" ON "agent_messages" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "agent_tasks_claim_idx" ON "agent_tasks" USING btree ("lane","status","due_at");--> statement-breakpoint
CREATE INDEX "agent_tasks_subject_idx" ON "agent_tasks" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "contact_facts_contact_idx" ON "contact_facts" USING btree ("contact_id","status");--> statement-breakpoint
CREATE INDEX "contact_facts_review_idx" ON "contact_facts" USING btree ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "agent_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE OR REPLACE FUNCTION claim_agent_task(p_lane text, p_lease_seconds int DEFAULT 120)
RETURNS SETOF agent_tasks
LANGUAGE sql
AS $claim$
  UPDATE agent_tasks t SET
    status = 'running',
    leased_until = now() + make_interval(secs => p_lease_seconds),
    attempts = attempts + 1
  WHERE t.id = (
    SELECT id FROM agent_tasks
    WHERE lane = p_lane::agent_lane
      AND due_at <= now()
      AND attempts < max_attempts
      AND (status = 'queued' OR (status = 'running' AND leased_until < now()))
    ORDER BY priority DESC, due_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING t.*;
$claim$;
