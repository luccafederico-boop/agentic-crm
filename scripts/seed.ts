// Seeds deterministic demo data into the FIRST workspace found in the
// database. Log in once (so your workspace exists), then run: pnpm seed
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { activities, companies, contacts, deals } from "../lib/db/schema";

const COMPANY_SEED = [
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

const DEAL_TITLES = [
  { title: "Enterprise plan — annual", amount: "48000", stage: "proposal" },
  { title: "Team seats expansion", amount: "12000", stage: "qualified" },
  { title: "Platform migration", amount: "85000", stage: "lead" },
  { title: "Renewal 2026", amount: "36000", stage: "won" },
  { title: "Pilot program", amount: "5000", stage: "lead" },
  { title: "API add-on", amount: "9000", stage: "qualified" },
  { title: "Design system license", amount: "15000", stage: "proposal" },
  { title: "Support tier upgrade", amount: "7500", stage: "won" },
  { title: "Multi-region deployment", amount: "120000", stage: "lead" },
  { title: "Analytics bundle", amount: "18000", stage: "lost" },
  { title: "Onboarding services", amount: "6000", stage: "qualified" },
  { title: "Security review package", amount: "22000", stage: "proposal" },
  { title: "Custom integration", amount: "30000", stage: "lead" },
  { title: "Training workshop", amount: "4000", stage: "won" },
  { title: "Startup plan — annual", amount: "3600", stage: "qualified" },
] as const;

async function main() {
  const workspace = await db.query.workspaces.findFirst();
  if (!workspace) {
    console.error(
      "No workspace found. Sign in to the app once, then run pnpm seed again.",
    );
    process.exit(1);
  }
  console.log(`Seeding workspace "${workspace.name}" (${workspace.id})…`);

  // Idempotent: wipe this workspace's domain data first.
  await db.delete(activities).where(eq(activities.workspaceId, workspace.id));
  await db.delete(deals).where(eq(deals.workspaceId, workspace.id));
  await db.delete(contacts).where(eq(contacts.workspaceId, workspace.id));
  await db.delete(companies).where(eq(companies.workspaceId, workspace.id));

  const insertedCompanies = await db
    .insert(companies)
    .values(
      COMPANY_SEED.map((c) => ({
        ...c,
        website: `https://${c.domain}`,
        workspaceId: workspace.id,
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
          workspaceId: workspace.id,
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
        workspaceId: workspace.id,
        companyId: insertedCompanies[i % insertedCompanies.length].id,
        title: d.title,
        amount: d.amount,
        stage: d.stage,
        currency: "USD",
        expectedClose: new Date(2026, 8 + (i % 4), 15)
          .toISOString()
          .slice(0, 10),
      })),
    )
    .returning();

  await db.insert(activities).values([
    ...insertedContacts.slice(0, 10).map((c, i) => ({
      workspaceId: workspace.id,
      type: "note" as const,
      subjectType: "contact",
      subjectId: c.id,
      title: "Note",
      body: `Met at the ${["conference", "webinar", "meetup", "demo"][i % 4]} — follow up next week.`,
    })),
    ...insertedDeals.slice(0, 8).map((d) => ({
      workspaceId: workspace.id,
      type: "system" as const,
      subjectType: "deal",
      subjectId: d.id,
      title: `Deal "${d.title}" created`,
    })),
  ]);

  console.log(
    `Seeded ${insertedCompanies.length} companies, ${insertedContacts.length} contacts, ${insertedDeals.length} deals.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
