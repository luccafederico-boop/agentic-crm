// Integration test for the DB-backed queue. Requires DATABASE_URL with the
// migrations applied (CI runs a Postgres service + pnpm db:migrate first).
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  claimTask,
  enqueueTask,
  failTask,
  requeueStale,
} from "@/lib/agent/queue";
import { db } from "@/lib/db";
import { agentTasks, contacts, workspaces } from "@/lib/db/schema";

const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

const OWNER_ID = "00000000-0000-4000-8000-00000000abcd";
let workspaceId: string;
let contactId: string;

suite("agent queue claiming", () => {
  beforeAll(async () => {
    const [ws] = await db
      .insert(workspaces)
      .values({ ownerId: OWNER_ID, name: "queue-test" })
      .onConflictDoUpdate({
        target: workspaces.ownerId,
        set: { name: "queue-test" },
      })
      .returning();
    workspaceId = ws.id;
    const [c] = await db
      .insert(contacts)
      .values({ workspaceId, name: "Queue Test Contact" })
      .returning();
    contactId = c.id;
  });

  afterAll(async () => {
    // Cascades to contacts/tasks created by the tests.
    await db.delete(workspaces).where(sql`${workspaces.id} = ${workspaceId}`);
  });

  it("claims a queued task exactly once under concurrency", async () => {
    const task = await enqueueTask({
      workspaceId,
      lane: "research",
      kind: "test_kind_concurrency",
      subjectType: "contact",
      subjectId: contactId,
    });
    expect(task).not.toBeNull();

    const [a, b, c] = await Promise.all([
      claimTask("research"),
      claimTask("research"),
      claimTask("research"),
    ]);
    const claimed = [a, b, c].filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe(task?.id);
    expect(claimed[0]?.status).toBe("running");

    // Clean up so later tests see an empty lane.
    await db.delete(agentTasks).where(inArray(agentTasks.id, [task?.id ?? ""]));
  });

  it("does not hand out tasks from another lane", async () => {
    const task = await enqueueTask({
      workspaceId,
      lane: "visible",
      kind: "test_kind_lane",
      subjectType: "contact",
      subjectId: contactId,
    });
    expect(task).not.toBeNull();

    const wrongLane = await claimTask("research");
    expect(wrongLane).toBeNull();

    const rightLane = await claimTask("visible");
    expect(rightLane?.id).toBe(task?.id);

    await db.delete(agentTasks).where(inArray(agentTasks.id, [task?.id ?? ""]));
  });

  it("reclaims a task whose lease expired via requeueStale", async () => {
    const task = await enqueueTask({
      workspaceId,
      lane: "research",
      kind: "test_kind_lease",
      subjectType: "contact",
      subjectId: contactId,
    });
    const first = await claimTask("research", 1);
    expect(first?.id).toBe(task?.id);

    // While leased, nothing else can claim it.
    expect(await claimTask("research")).toBeNull();

    // Expire the lease manually (no sleeping in tests).
    await db
      .update(agentTasks)
      .set({ leasedUntil: new Date(Date.now() - 1000) })
      .where(inArray(agentTasks.id, [task?.id ?? ""]));

    const requeued = await requeueStale();
    expect(requeued).toBeGreaterThanOrEqual(1);

    const second = await claimTask("research");
    expect(second?.id).toBe(task?.id);
    expect(second?.attempts).toBe(2);

    await db.delete(agentTasks).where(inArray(agentTasks.id, [task?.id ?? ""]));
  });

  it("dedupes identical queued tasks and stops retrying after maxAttempts", async () => {
    const task = await enqueueTask({
      workspaceId,
      lane: "research",
      kind: "test_kind_dedupe",
      subjectType: "contact",
      subjectId: contactId,
    });
    expect(task).not.toBeNull();

    const duplicate = await enqueueTask({
      workspaceId,
      lane: "research",
      kind: "test_kind_dedupe",
      subjectType: "contact",
      subjectId: contactId,
    });
    expect(duplicate).toBeNull();

    // Exhaust attempts: claim + fail three times.
    for (let i = 1; i <= 3; i++) {
      await db
        .update(agentTasks)
        .set({ dueAt: new Date(Date.now() - 1000) })
        .where(inArray(agentTasks.id, [task?.id ?? ""]));
      const claimed = await claimTask("research");
      expect(claimed?.id).toBe(task?.id);
      if (claimed) await failTask(claimed, `boom ${i}`);
    }

    const gone = await claimTask("research");
    expect(gone).toBeNull();

    await db.delete(agentTasks).where(inArray(agentTasks.id, [task?.id ?? ""]));
  });
});
