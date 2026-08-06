import { NextResponse } from "next/server";
import { requeueStale } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";

export const maxDuration = 60;

// Daily backstop: requeue stale leases and drain whatever is waiting.
// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when the CRON_SECRET env var is set.
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization");
  const allowed = [process.env.CRON_SECRET, process.env.AGENT_DRAIN_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (!allowed.includes(bearer ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const requeued = await requeueStale();
  const stats = await drainQueue(40_000);
  return NextResponse.json({ requeued, ...stats });
}
