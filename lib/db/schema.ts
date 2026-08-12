import { sql } from "drizzle-orm";
import {
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// One workspace per user (auto-created on first login). workspace_id is the
// tenancy key on every domain table so the model survives a future multi-user
// upgrade without surgery.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  // References auth.users(id) — managed by Supabase Auth, so no FK here.
  ownerId: uuid("owner_id").notNull().unique(),
  name: text("name").notNull(),
  baseCurrency: char("base_currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dealStage = pgEnum("deal_stage", [
  "lead",
  "qualified",
  "proposal",
  "won",
  "lost",
]);

export const activityType = pgEnum("activity_type", [
  "note",
  "call",
  "email",
  "meeting",
  "system",
  "agent",
]);

export const activityActor = pgEnum("activity_actor", [
  "user",
  "agent",
  "sync",
]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    website: text("website"),
    industry: text("industry"),
    size: text("size"),
    logoPath: text("logo_path"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("companies_workspace_idx").on(t.workspaceId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    linkedinUrl: text("linkedin_url"),
    location: text("location"),
    avatarUrl: text("avatar_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contacts_workspace_idx").on(t.workspaceId),
    index("contacts_email_idx").on(t.email),
    index("contacts_company_idx").on(t.companyId),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    stage: dealStage("stage").notNull().default("lead"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    expectedClose: date("expected_close"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("deals_workspace_idx").on(t.workspaceId),
    index("deals_company_idx").on(t.companyId),
  ],
);

export const dealContacts = pgTable(
  "deal_contacts",
  {
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.contactId] })],
);

// Timeline entries. Polymorphic subject: ("contact" | "company" | "deal") + id.
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: activityType("type").notNull(),
    actor: activityActor("actor").notNull().default("user"),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    // Set by Google sync (gmail:<messageId> / gcal:<eventId>) so re-syncs
    // never duplicate timeline entries.
    externalId: text("external_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activities_workspace_idx").on(t.workspaceId),
    index("activities_subject_idx").on(t.subjectType, t.subjectId),
    uniqueIndex("activities_external_idx")
      .on(t.workspaceId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

// One connected Google account per workspace (Phase 5). The refresh token is
// AES-256-GCM encrypted with APP_ENCRYPTION_KEY before it touches the DB.
export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  scopes: text("scopes").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
});

// Cached FX rates (frankfurter.app, ECB data). Global reference data, not
// workspace-scoped. rate = units of `quote` per 1 `base`, so converting an
// amount in `quote` to `base` is amount / rate.
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

// ---------------------------------------------------------------------------
// Agent (Phase 2)
// ---------------------------------------------------------------------------

export const agentLane = pgEnum("agent_lane", ["visible", "research"]);

export const agentTaskStatus = pgEnum("agent_task_status", [
  "queued",
  "running",
  "done",
  "failed",
  "canceled",
]);

export const factBand = pgEnum("fact_band", [
  "verified",
  "probable",
  "possible",
]);

export const factStatus = pgEnum("fact_status", [
  "applied",
  "proposed",
  "dismissed",
  "superseded",
]);

// DB-backed work queue. Rows are claimed with a lease via the
// claim_agent_task() SQL function (FOR UPDATE SKIP LOCKED) so concurrent
// drains never double-claim.
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    lane: agentLane("lane").notNull().default("research"),
    kind: text("kind").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    payload: jsonb("payload"),
    priority: integer("priority").notNull().default(0),
    // Max tool calls the agent may spend on this task.
    budget: integer("budget").notNull().default(15),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    status: agentTaskStatus("status").notNull().default("queued"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("agent_tasks_claim_idx").on(t.lane, t.status, t.dueAt),
    index("agent_tasks_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

export const agentEvents = pgTable(
  "agent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_events_task_idx").on(t.taskId)],
);

// Chat transcript per record (contact/company/deal).
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    role: text("role").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_messages_subject_idx").on(t.subjectType, t.subjectId)],
);

// The evidence ledger: every fact the agent finds, with its scored evidence.
// Strong evidence → applied to the record; weak → proposed for human review.
export const contactFacts = pgTable(
  "contact_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value").notNull(),
    score: numeric("score", { precision: 4, scale: 3 }).notNull(),
    band: factBand("band").notNull(),
    status: factStatus("status").notNull(),
    method: text("method"),
    sourceUrl: text("source_url"),
    evidence: jsonb("evidence").notNull(),
    taskId: uuid("task_id"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_facts_contact_idx").on(t.contactId, t.status),
    index("contact_facts_review_idx").on(t.workspaceId, t.status),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type DealStage = Deal["stage"];
export type AgentTask = typeof agentTasks.$inferSelect;
export type ContactFact = typeof contactFacts.$inferSelect;
