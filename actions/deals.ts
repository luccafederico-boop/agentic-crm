"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { dealContacts, deals } from "@/lib/db/schema";
import { CURRENCIES } from "@/lib/format";
import { type FormState, firstZodError, optionalText } from "@/lib/forms";

const dealSchema = z.object({
  id: optionalText,
  title: z.string().trim().min(1, "Title is required"),
  companyId: optionalText,
  stage: z.enum(deals.stage.enumValues).default("lead"),
  amount: optionalText.refine(
    (v) => v === null || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Amount must be a positive number",
  ),
  currency: z.enum(CURRENCIES).default("USD"),
  expectedClose: optionalText,
  notes: optionalText,
});

export async function saveDeal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await ensureWorkspace();
  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }
  const { id, ...values } = parsed.data;

  if (id) {
    await db
      .update(deals)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.workspaceId, workspace.id)));
    revalidatePath(`/deals/${id}`);
    revalidatePath("/deals");
    return { error: null };
  }

  const [created] = await db
    .insert(deals)
    .values({ ...values, workspaceId: workspace.id })
    .returning();
  await logActivity({
    workspaceId: workspace.id,
    type: "system",
    subjectType: "deal",
    subjectId: created.id,
    title: `Deal "${created.title}" created`,
  });
  redirect(`/deals/${created.id}`);
}

export async function moveDealStage(
  dealId: string,
  stage: (typeof deals.stage.enumValues)[number],
) {
  const workspace = await ensureWorkspace();
  const [updated] = await db
    .update(deals)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(deals.id, dealId), eq(deals.workspaceId, workspace.id)))
    .returning();
  if (updated) {
    await logActivity({
      workspaceId: workspace.id,
      type: "system",
      subjectType: "deal",
      subjectId: updated.id,
      title: `Stage changed to "${stage}"`,
    });
  }
  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
}

export async function deleteDeal(id: string) {
  const workspace = await ensureWorkspace();
  await db
    .delete(deals)
    .where(and(eq(deals.id, id), eq(deals.workspaceId, workspace.id)));
  revalidatePath("/deals");
  redirect("/deals");
}

export async function linkContactToDeal(formData: FormData) {
  const workspace = await ensureWorkspace();
  const dealId = String(formData.get("dealId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!dealId || !contactId) return;

  // Scope check: the deal must belong to this workspace.
  const deal = await db.query.deals.findFirst({
    where: and(eq(deals.id, dealId), eq(deals.workspaceId, workspace.id)),
  });
  if (!deal) return;

  await db
    .insert(dealContacts)
    .values({ dealId, contactId })
    .onConflictDoNothing();
  revalidatePath(`/deals/${dealId}`);
}

export async function unlinkContactFromDeal(dealId: string, contactId: string) {
  const workspace = await ensureWorkspace();
  const deal = await db.query.deals.findFirst({
    where: and(eq(deals.id, dealId), eq(deals.workspaceId, workspace.id)),
  });
  if (!deal) return;

  await db
    .delete(dealContacts)
    .where(
      and(
        eq(dealContacts.dealId, dealId),
        eq(dealContacts.contactId, contactId),
      ),
    );
  revalidatePath(`/deals/${dealId}`);
}
