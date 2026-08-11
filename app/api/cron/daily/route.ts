import { NextResponse } from "next/server";
import { enqueueTask, requeueStale } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";
import { db } from "@/lib/db";

export const maxDuration = 60;

// Daily backstop: requeue stale leases, schedule Google syncs for connected
// accounts, and drain whatever is waiting. Vercel Cron sends
// `Authorization: Bearer ${CRON_SECRET}` automatically when the CRON_SECRET
// env var is set.
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization");
  const allowed = [process.env.CRON_SECRET, process.env.AGENT_DRAIN_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (!allowed.includes(bearer ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const requeued = await requeueStale();

  const connected = await db.query.googleAccounts.findMany();
  for (const account of connected) {
    await enqueueTask({
      workspaceId: account.workspaceId,
      lane: "visible",
      kind: "google_sync",
      subjectType: "workspace",
      subjectId: account.workspaceId,
    });
  }

  const stats = await drainQueue(40_000);
  return NextResponse.json({
    requeued,
    syncsEnqueued: connected.length,
    ...stats,
  });
}
