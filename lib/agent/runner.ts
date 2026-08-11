import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { and, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { type AgentTask, companies, contacts } from "@/lib/db/schema";
import { RESEARCH_SYSTEM_PROMPT, researchTaskPrompt } from "./prompts";
import {
  claimTask,
  completeTask,
  failTask,
  type Lane,
  logEvent,
} from "./queue";
import { buildContactTools } from "./tools";

const MODEL_ID = process.env.AGENT_MODEL ?? "claude-sonnet-5";

export type DrainStats = {
  processed: number;
  failed: number;
  byLane: Record<Lane, number>;
};

/**
 * Bounded drain loop: claims and executes tasks until the queue is empty or
 * the time budget runs out. Safe to call concurrently — claiming uses
 * FOR UPDATE SKIP LOCKED.
 */
export async function drainQueue(maxMs = 45_000): Promise<DrainStats> {
  const deadline = Date.now() + maxMs;
  const stats: DrainStats = {
    processed: 0,
    failed: 0,
    byLane: { visible: 0, research: 0 },
  };

  // Visible lane first (cheap, no LLM), then research.
  for (const lane of ["visible", "research"] as const) {
    while (Date.now() < deadline) {
      const task = await claimTask(lane);
      if (!task) break;
      try {
        await logEvent(task.id, "started", { attempt: task.attempts });
        await executeTask(task);
        await completeTask(task.id);
        stats.processed++;
        stats.byLane[lane]++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await logEvent(task.id, "error", { message });
        await failTask(task, message);
        stats.failed++;
      }
    }
  }
  return stats;
}

async function executeTask(task: AgentTask) {
  switch (task.kind) {
    case "research_contact":
      await runContactResearch(task);
      break;
    case "mirror_logo":
      await runLogoMirror(task);
      break;
    case "google_sync": {
      const { runGoogleSync } = await import("@/lib/google/sync");
      const stats = await runGoogleSync(task.workspaceId);
      await logEvent(task.id, "synced", stats);
      break;
    }
    default:
      throw new Error(`Unknown task kind: ${task.kind}`);
  }
}

/** Visible-lane task (no LLM): mirror the company favicon into Supabase
 * Storage so the app stops hotlinking third parties. */
async function runLogoMirror(task: AgentTask) {
  const company = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, task.subjectId),
      eq(companies.workspaceId, task.workspaceId),
    ),
  });
  if (!company) throw new Error("Company no longer exists");
  if (!company.domain) {
    await logEvent(task.id, "skipped", { reason: "no domain" });
    return;
  }

  const res = await fetch(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(company.domain)}&sz=128`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`Favicon fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength < 100) {
    await logEvent(task.id, "skipped", { reason: "favicon too small/empty" });
    return;
  }

  const { uploadLogo } = await import("@/lib/supabase/storage");
  const path = await uploadLogo(company.id, bytes, contentType);
  await db
    .update(companies)
    .set({ logoPath: path, updatedAt: new Date() })
    .where(eq(companies.id, company.id));
  await logEvent(task.id, "mirrored", { path, bytes: bytes.byteLength });
}

async function runContactResearch(task: AgentTask) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — research lane disabled");
  }

  const [row] = await db
    .select({ contact: contacts, company: companies })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(
      and(
        eq(contacts.id, task.subjectId),
        eq(contacts.workspaceId, task.workspaceId),
      ),
    );
  if (!row) throw new Error("Contact no longer exists");
  const { contact, company } = row;

  const tools = buildContactTools({
    workspaceId: task.workspaceId,
    contactId: contact.id,
    taskId: task.id,
  });

  // budget = max tool-use steps for this task.
  const maxSteps = Math.max(2, Math.min(task.budget, 12));

  const result = await generateText({
    model: anthropic(MODEL_ID),
    system: RESEARCH_SYSTEM_PROMPT,
    prompt: researchTaskPrompt({
      name: contact.name,
      email: contact.email,
      role: contact.role,
      location: contact.location,
      companyName: company?.name ?? null,
      companyDomain: company?.domain ?? null,
    }),
    tools,
    stopWhen: stepCountIs(maxSteps),
    onStepFinish: async (step) => {
      await logEvent(task.id, "step", {
        toolCalls: step.toolCalls.map((c) => c.toolName),
        tokens: step.usage?.totalTokens ?? null,
      });
    },
  });

  await logEvent(task.id, "finished", {
    summary: result.text.slice(0, 1000),
    steps: result.steps.length,
    totalTokens: result.totalUsage?.totalTokens ?? null,
  });

  await logActivity({
    workspaceId: task.workspaceId,
    type: "agent",
    actor: "agent",
    subjectType: "contact",
    subjectId: contact.id,
    title: "Research completed",
    body: result.text.slice(0, 2000) || "No summary produced.",
  });
}
