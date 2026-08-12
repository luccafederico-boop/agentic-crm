import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { type Workspace, workspaces } from "@/lib/db/schema";
import { seedDemoData } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

/** Redirects to /login when there is no authenticated user. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
});

/**
 * Non-redirecting auth for API routes: returns the authed user and their
 * workspace, or null if either is missing. API routes must answer with JSON
 * or their own redirect, so they can't use requireUser()/ensureWorkspace()
 * (which redirect to /login). Does not create a workspace — a signed-in user
 * always has one from their first page load.
 */
export async function getUserWorkspace(): Promise<{
  user: User;
  workspace: Workspace;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, user.id),
  });
  if (!workspace) return null;

  return { user, workspace };
}

/** Idempotently creates the user's workspace on first login. */
export const ensureWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();

  const existing = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, user.id),
  });
  if (existing) return existing;

  const name = user.email
    ? `${user.email.split("@")[0]}'s workspace`
    : "My workspace";
  const [created] = await db
    .insert(workspaces)
    .values({ ownerId: user.id, name })
    .onConflictDoNothing({ target: workspaces.ownerId })
    .returning();

  if (created) {
    // New signup: populate the workspace so visitors land in a working CRM,
    // then mirror the demo logos in the background. Never block login on it.
    try {
      await seedDemoData(created.id);
      after(async () => {
        const { drainQueue } = await import("@/lib/agent/runner");
        await drainQueue(30_000).catch(() => {});
      });
    } catch (err) {
      console.error("[auth] demo seeding failed (continuing):", err);
    }
    return created;
  }

  // Lost a race with a concurrent request — the row exists now.
  const row = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, user.id),
  });
  if (!row) throw new Error("Failed to create workspace");
  return row;
});
