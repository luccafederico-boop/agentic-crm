// Per-workspace daily caps on LLM-backed features. This is a public portfolio
// app with open signup — the caps keep a curious visitor from draining the
// Anthropic budget. Day boundary is UTC.
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentMessages, agentTasks } from "@/lib/db/schema";

const RESEARCH_PER_DAY = Number(process.env.RESEARCH_DAILY_LIMIT ?? 5);
const CHAT_MSGS_PER_DAY = Number(process.env.CHAT_DAILY_LIMIT ?? 20);

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Remaining research runs today (0 = limit reached). */
export async function researchRunsRemaining(
  workspaceId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.workspaceId, workspaceId),
        eq(agentTasks.kind, "research_contact"),
        gte(agentTasks.createdAt, startOfUtcDay()),
      ),
    );
  return Math.max(0, RESEARCH_PER_DAY - (row?.count ?? 0));
}

/** Remaining chat messages today (0 = limit reached). */
export async function chatMessagesRemaining(
  workspaceId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(agentMessages)
    .where(
      and(
        eq(agentMessages.workspaceId, workspaceId),
        eq(agentMessages.role, "user"),
        gte(agentMessages.createdAt, startOfUtcDay()),
      ),
    );
  return Math.max(0, CHAT_MSGS_PER_DAY - (row?.count ?? 0));
}
