// Wipes and re-seeds the FIRST workspace found in the database with the demo
// dataset. Log in once (so your workspace exists), then run: pnpm seed
// New signups seed themselves automatically via lib/demo-data.ts.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { activities, companies, contacts, deals } from "../lib/db/schema";
import { seedDemoData } from "../lib/demo-data";

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

  const result = await seedDemoData(workspace.id);
  console.log(
    `Seeded ${result.companies} companies, ${result.contacts} contacts, ${result.deals} deals. Logo mirroring queued — drain the agent queue (or open the app) to run it.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
