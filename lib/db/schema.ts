import {
  char,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type DealStage = Deal["stage"];
