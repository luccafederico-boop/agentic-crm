// Deterministic demo dataset, shared by `pnpm seed` (dev refresh) and by
// first-login auto-seeding so a brand-new visitor lands in a populated CRM.
import { db } from "@/lib/db";
import {
  activities,
  agentTasks,
  companies,
  contacts,
  deals,
} from "@/lib/db/schema";

const DEMO_COMPANIES = [
  {
    name: "Vercel",
    domain: "vercel.com",
    industry: "Developer tools",
    size: "201-500",
  },
  {
    name: "Supabase",
    domain: "supabase.com",
    industry: "Databases",
    size: "51-200",
  },
  {
    name: "Anthropic",
    domain: "anthropic.com",
    industry: "AI research",
    size: "501-1000",
  },
  {
    name: "Linear",
    domain: "linear.app",
    industry: "Project management",
    size: "51-200",
  },
  {
    name: "Stripe",
    domain: "stripe.com",
    industry: "Payments",
    size: "1001-5000",
  },
  { name: "Figma", domain: "figma.com", industry: "Design", size: "501-1000" },
  {
    name: "Notion",
    domain: "notion.so",
    industry: "Productivity",
    size: "201-500",
  },
  {
    name: "Raycast",
    domain: "raycast.com",
    industry: "Developer tools",
    size: "11-50",
  },
  {
    name: "Resend",
    domain: "resend.com",
    industry: "Email infrastructure",
    size: "11-50",
  },
  {
    name: "PostHog",
    domain: "posthog.com",
    industry: "Analytics",
    size: "51-200",
  },
];

const FIRST_NAMES = [
  "Alice",
  "Bruno",
  "Carla",
  "Diego",
  "Elena",
  "Felipe",
  "Gabriela",
  "Henry",
  "Isabela",
  "João",
  "Karen",
  "Lucas",
  "Marina",
  "Nathan",
  "Olivia",
  "Paulo",
  "Quinn",
  "Rafaela",
  "Samuel",
  "Tatiana",
  "Ursula",
  "Victor",
  "Wendy",
  "Xavier",
  "Yara",
  "Zoe",
  "Arthur",
  "Beatriz",
  "Caio",
  "Daniela",
];

const ROLES = [
  "CEO",
  "CTO",
  "Head of Sales",
  "Product Manager",
  "Engineering Manager",
  "Designer",
  "Account Executive",
  "Founder",
  "VP of Marketing",
  "Data Analyst",
];

// Mixed currencies on purpose: totals convert to the workspace base currency
// at aggregation time (Phase 4).
const DEAL_TITLES = [
  {
    title: "Enterprise plan — annual",
    amount: "48000",
    stage: "proposal",
    currency: "USD",
  },
  {
    title: "Team seats expansion",
    amount: "12000",
    stage: "qualified",
    currency: "EUR",
  },
  {
    title: "Platform migration",
    amount: "85000",
    stage: "lead",
    currency: "USD",
  },
  { title: "Renewal 2026", amount: "36000", stage: "won", currency: "USD" },
  { title: "Pilot program", amount: "5000", stage: "lead", currency: "GBP" },
  { title: "API add-on", amount: "9000", stage: "qualified", currency: "USD" },
  {
    title: "Design system license",
    amount: "15000",
    stage: "proposal",
    currency: "EUR",
  },
  {
    title: "Support tier upgrade",
    amount: "7500",
    stage: "won",
    currency: "BRL",
  },
  {
    title: "Multi-region deployment",
    amount: "120000",
    stage: "lead",
    currency: "USD",
  },
  {
    title: "Analytics bundle",
    amount: "18000",
    stage: "lost",
    currency: "USD",
  },
  {
    title: "Onboarding services",
    amount: "30000",
    stage: "qualified",
    currency: "BRL",
  },
  {
    title: "Security review package",
    amount: "22000",
    stage: "proposal",
    currency: "USD",
  },
  {
    title: "Custom integration",
    amount: "30000",
    stage: "lead",
    currency: "EUR",
  },
  { title: "Training workshop", amount: "4000", stage: "won", currency: "GBP" },
  {
    title: "Startup plan — annual",
    amount: "3600",
    stage: "qualified",
    currency: "USD",
  },
] as const;

export type DemoSeedResult = {
  companies: number;
  contacts: number;
  deals: number;
};

/**
 * Populates a workspace with the demo dataset and queues logo mirroring for
 * every seeded company. Assumes the workspace has no conflicting data (a
 * brand-new workspace, or one just wiped by scripts/seed.ts).
 */
export async function seedDemoData(
  workspaceId: string,
): Promise<DemoSeedResult> {
  const insertedCompanies = await db
    .insert(companies)
    .values(
      DEMO_COMPANIES.map((c) => ({
        ...c,
        website: `https://${c.domain}`,
        workspaceId,
      })),
    )
    .returning();

  const insertedContacts = await db
    .insert(contacts)
    .values(
      FIRST_NAMES.map((first, i) => {
        const company = insertedCompanies[i % insertedCompanies.length];
        const last = ["Silva", "Souza", "Miller", "Chen", "Garcia"][i % 5];
        return {
          workspaceId,
          companyId: company.id,
          name: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@${company.domain}`,
          role: ROLES[i % ROLES.length],
          location: [
            "São Paulo, BR",
            "New York, US",
            "London, UK",
            "Berlin, DE",
          ][i % 4],
        };
      }),
    )
    .returning();

  const insertedDeals = await db
    .insert(deals)
    .values(
      DEAL_TITLES.map((d, i) => ({
        workspaceId,
        companyId: insertedCompanies[i % insertedCompanies.length].id,
        title: d.title,
        amount: d.amount,
        stage: d.stage,
        currency: d.currency,
        expectedClose: new Date(2026, 8 + (i % 4), 15)
          .toISOString()
          .slice(0, 10),
      })),
    )
    .returning();

  await db.insert(activities).values([
    ...insertedContacts.slice(0, 10).map((c, i) => ({
      workspaceId,
      type: "note" as const,
      subjectType: "contact",
      subjectId: c.id,
      title: "Note",
      body: `Met at the ${["conference", "webinar", "meetup", "demo"][i % 4]} — follow up next week.`,
    })),
    ...insertedDeals.slice(0, 8).map((d) => ({
      workspaceId,
      type: "system" as const,
      subjectType: "deal",
      subjectId: d.id,
      title: `Deal "${d.title}" created`,
    })),
  ]);

  // Queue logo mirroring directly (fresh workspace — no dedupe check needed).
  await db.insert(agentTasks).values(
    insertedCompanies.map((c) => ({
      workspaceId,
      lane: "visible" as const,
      kind: "mirror_logo",
      subjectType: "company",
      subjectId: c.id,
      priority: 100,
      budget: 1,
    })),
  );

  return {
    companies: insertedCompanies.length,
    contacts: insertedContacts.length,
    deals: insertedDeals.length,
  };
}
