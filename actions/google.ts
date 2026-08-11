"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { enqueueTask } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleAccounts } from "@/lib/db/schema";

export async function disconnectGoogle() {
  const workspace = await ensureWorkspace();
  await db
    .delete(googleAccounts)
    .where(eq(googleAccounts.workspaceId, workspace.id));
  revalidatePath("/settings");
}

export async function syncGoogleNow() {
  const workspace = await ensureWorkspace();
  const account = await db.query.googleAccounts.findFirst({
    where: eq(googleAccounts.workspaceId, workspace.id),
  });
  if (!account) return;

  await enqueueTask({
    workspaceId: workspace.id,
    lane: "visible",
    kind: "google_sync",
    subjectType: "workspace",
    subjectId: workspace.id,
  });
  after(() => drainQueue(40_000));
  revalidatePath("/settings");
}
