import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { type Workspace, workspaces } from "@/lib/db/schema";
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

  if (created) return created;

  // Lost a race with a concurrent request — the row exists now.
  const row = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, user.id),
  });
  if (!row) throw new Error("Failed to create workspace");
  return row;
});
