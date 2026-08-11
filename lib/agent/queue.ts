import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type AgentTask, agentEvents, agentTasks } from "@/lib/db/schema";

export type Lane = "visible" | "research";

type EnqueueInput = {
  workspaceId: string;
  lane: Lane;
  kind: string;
  subjectType: "contact" | "company" | "deal" | "workspace";
  subjectId: string;
  payload?: unknown;
  priority?: number;
  budget?: number;
};

/** Enqueue a task unless an identical one is already waiting or running. */
export async function enqueueTask(
  input: EnqueueInput,
): Promise<AgentTask | null> {
  const existing = await db.query.agentTasks.findFirst({
    where: and(
      eq(agentTasks.workspaceId, input.workspaceId),
      eq(agentTasks.kind, input.kind),
      eq(agentTasks.subjectType, input.subjectType),
      eq(agentTasks.subjectId, input.subjectId),
      inArray(agentTasks.status, ["queued", "running"]),
    ),
  });
  if (existing) return null;

  const [task] = await db
    .insert(agentTasks)
    .values({
      workspaceId: input.workspaceId,
      lane: input.lane,
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: input.payload ?? null,
      priority: input.priority ?? 0,
      budget: input.budget ?? 15,
    })
    .returning();
  return task;
}

/**
 * Claim the next due task in a lane using the claim_agent_task() SQL function
 * (FOR UPDATE SKIP LOCKED + lease) — concurrent drains never double-claim.
 */
export async function claimTask(
  lane: Lane,
  leaseSeconds = 120,
): Promise<AgentTask | null> {
  const rows = (await db.execute(
    sql`select * from claim_agent_task(${lane}, ${leaseSeconds})`,
  )) as unknown as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    lane: row.lane,
    kind: row.kind,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    payload: row.payload,
    priority: row.priority,
    budget: row.budget,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    status: row.status,
    dueAt: new Date(row.due_at as string),
    leasedUntil: row.leased_until ? new Date(row.leased_until as string) : null,
    lastError: row.last_error,
    createdAt: new Date(row.created_at as string),
    finishedAt: row.finished_at ? new Date(row.finished_at as string) : null,
  } as AgentTask;
}

export async function completeTask(taskId: string) {
  await db
    .update(agentTasks)
    .set({ status: "done", finishedAt: new Date(), leasedUntil: null })
    .where(eq(agentTasks.id, taskId));
}

export async function failTask(task: AgentTask, error: string) {
  const retryable = task.attempts < task.maxAttempts;
  const backoffSeconds = 30 * task.attempts ** 2;
  await db
    .update(agentTasks)
    .set(
      retryable
        ? {
            status: "queued",
            lastError: error.slice(0, 2000),
            leasedUntil: null,
            dueAt: new Date(Date.now() + backoffSeconds * 1000),
          }
        : {
            status: "failed",
            lastError: error.slice(0, 2000),
            leasedUntil: null,
            finishedAt: new Date(),
          },
    )
    .where(eq(agentTasks.id, task.id));
}

export async function logEvent(taskId: string, type: string, data?: unknown) {
  await db.insert(agentEvents).values({ taskId, type, data: data ?? null });
}

/** Requeue tasks whose lease expired (crashed or timed-out runner). */
export async function requeueStale() {
  const requeued = await db
    .update(agentTasks)
    .set({ status: "queued", leasedUntil: null })
    .where(
      and(
        eq(agentTasks.status, "running"),
        lt(agentTasks.leasedUntil, new Date()),
      ),
    )
    .returning({ id: agentTasks.id });
  return requeued.length;
}
