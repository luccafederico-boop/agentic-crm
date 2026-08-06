"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { type FormState, firstZodError, optionalText } from "@/lib/forms";

const contactSchema = z.object({
  id: optionalText,
  name: z.string().trim().min(1, "Name is required"),
  email: optionalText,
  phone: optionalText,
  role: optionalText,
  companyId: optionalText,
  linkedinUrl: optionalText,
  location: optionalText,
  notes: optionalText,
});

export async function saveContact(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await ensureWorkspace();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }
  const { id, ...values } = parsed.data;

  if (id) {
    await db
      .update(contacts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)));
    revalidatePath(`/contacts/${id}`);
    revalidatePath("/contacts");
    return { error: null };
  }

  const [created] = await db
    .insert(contacts)
    .values({ ...values, workspaceId: workspace.id })
    .returning();
  await logActivity({
    workspaceId: workspace.id,
    type: "system",
    subjectType: "contact",
    subjectId: created.id,
    title: `Contact "${created.name}" created`,
  });
  redirect(`/contacts/${created.id}`);
}

export async function deleteContact(id: string) {
  const workspace = await ensureWorkspace();
  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)));
  revalidatePath("/contacts");
  redirect("/contacts");
}
