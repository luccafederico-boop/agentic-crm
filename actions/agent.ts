"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logActivity } from "@/lib/activity";
import { isFactField } from "@/lib/agent/evidence";
import { enqueueTask } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";
import { ensureWorkspace, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactFacts, contacts } from "@/lib/db/schema";
import { researchRunsRemaining } from "@/lib/limits";

export async function researchContact(
  contactId: string,
): Promise<{ queued: boolean; message: string }> {
  const workspace = await ensureWorkspace();

  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, contactId),
      eq(contacts.workspaceId, workspace.id),
    ),
  });
  if (!contact) return { queued: false, message: "Contact not found." };

  if ((await researchRunsRemaining(workspace.id)) <= 0) {
    return {
      queued: false,
      message:
        "Daily research limit reached for this workspace — try again tomorrow.",
    };
  }

  const task = await enqueueTask({
    workspaceId: workspace.id,
    lane: "research",
    kind: "research_contact",
    subjectType: "contact",
    subjectId: contactId,
    priority: 10,
    budget: 15,
  });

  if (!task) {
    return { queued: false, message: "Research already queued or running." };
  }

  // After-response poke: the queue drains in this invocation's extended
  // lifetime, so results land within seconds — no cron dependency.
  after(async () => {
    try {
      await drainQueue(40_000);
    } catch {
      // The daily cron backstop will requeue and retry.
    }
  });

  revalidatePath(`/contacts/${contactId}`);
  return { queued: true, message: "Research started." };
}

export async function approveFact(factId: string) {
  const workspace = await ensureWorkspace();
  const user = await requireUser();

  const fact = await db.query.contactFacts.findFirst({
    where: and(
      eq(contactFacts.id, factId),
      eq(contactFacts.workspaceId, workspace.id),
      eq(contactFacts.status, "proposed"),
    ),
  });
  if (!fact || !isFactField(fact.field)) return;

  // Explicit human approval may overwrite the current value.
  await db
    .update(contactFacts)
    .set({ status: "superseded" })
    .where(
      and(
        eq(contactFacts.contactId, fact.contactId),
        eq(contactFacts.field, fact.field),
        eq(contactFacts.status, "applied"),
      ),
    );
  await db
    .update(contacts)
    .set({ [fact.field]: fact.value, updatedAt: new Date() })
    .where(eq(contacts.id, fact.contactId));
  await db
    .update(contactFacts)
    .set({
      status: "applied",
      decidedBy: user.email ?? user.id,
      decidedAt: new Date(),
    })
    .where(eq(contactFacts.id, factId));

  await logActivity({
    workspaceId: workspace.id,
    type: "agent",
    actor: "user",
    subjectType: "contact",
    subjectId: fact.contactId,
    title: `Approved agent fact: ${fact.field} = "${fact.value}"`,
  });

  revalidatePath("/review");
  revalidatePath(`/contacts/${fact.contactId}`);
}

export async function dismissFact(factId: string) {
  const workspace = await ensureWorkspace();
  const user = await requireUser();

  const fact = await db.query.contactFacts.findFirst({
    where: and(
      eq(contactFacts.id, factId),
      eq(contactFacts.workspaceId, workspace.id),
      eq(contactFacts.status, "proposed"),
    ),
  });
  if (!fact) return;

  await db
    .update(contactFacts)
    .set({
      status: "dismissed",
      decidedBy: user.email ?? user.id,
      decidedAt: new Date(),
    })
    .where(eq(contactFacts.id, factId));

  revalidatePath("/review");
  revalidatePath(`/contacts/${fact.contactId}`);
}
