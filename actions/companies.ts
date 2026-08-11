"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { enqueueTask } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { type FormState, firstZodError, optionalText } from "@/lib/forms";

const companySchema = z.object({
  id: optionalText,
  name: z.string().trim().min(1, "Name is required"),
  domain: optionalText,
  website: optionalText,
  industry: optionalText,
  size: optionalText,
  notes: optionalText,
});

async function queueLogoMirror(workspaceId: string, companyId: string) {
  const task = await enqueueTask({
    workspaceId,
    lane: "visible",
    kind: "mirror_logo",
    subjectType: "company",
    subjectId: companyId,
    priority: 100,
    budget: 1,
  });
  if (task) {
    after(async () => {
      try {
        await drainQueue(20_000);
      } catch {
        // Daily cron backstop retries.
      }
    });
  }
}

export async function saveCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await ensureWorkspace();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }
  const { id, ...values } = parsed.data;

  if (id) {
    await db
      .update(companies)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(eq(companies.id, id), eq(companies.workspaceId, workspace.id)),
      );
    if (values.domain) {
      await queueLogoMirror(workspace.id, id);
    }
    revalidatePath(`/companies/${id}`);
    revalidatePath("/companies");
    return { error: null };
  }

  const [created] = await db
    .insert(companies)
    .values({ ...values, workspaceId: workspace.id })
    .returning();
  await logActivity({
    workspaceId: workspace.id,
    type: "system",
    subjectType: "company",
    subjectId: created.id,
    title: `Company "${created.name}" created`,
  });
  if (created.domain) {
    await queueLogoMirror(workspace.id, created.id);
  }
  redirect(`/companies/${created.id}`);
}

export async function deleteCompany(id: string) {
  const workspace = await ensureWorkspace();
  await db
    .delete(companies)
    .where(and(eq(companies.id, id), eq(companies.workspaceId, workspace.id)));
  revalidatePath("/companies");
  redirect("/companies");
}
