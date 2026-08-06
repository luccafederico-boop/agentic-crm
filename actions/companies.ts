"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
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
