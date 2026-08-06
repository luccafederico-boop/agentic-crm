import { NextResponse } from "next/server";
import { requeueStale } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";

export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.AGENT_DRAIN_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("s");
  return bearer === `Bearer ${secret}` || queryToken === secret;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const requeued = await requeueStale();
  const stats = await drainQueue(45_000);
  return NextResponse.json({ requeued, ...stats });
}

export const POST = handle;
// GET enables external pingers (cron-job.org) as a drain backstop.
export const GET = handle;
