"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ensureWorkspace } from "@/lib/auth";
import type { FormState } from "@/lib/forms";

const noteSchema = z.object({
  subjectType: z.enum(["contact", "company", "deal"]),
  subjectId: z.uuid(),
  body: z.string().trim().min(1, "Note cannot be empty"),
});

export async function addNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const workspace = await ensureWorkspace();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Note cannot be empty" };
  }
  const { subjectType, subjectId, body } = parsed.data;

  await logActivity({
    workspaceId: workspace.id,
    type: "note",
    subjectType,
    subjectId,
    title: "Note",
    body,
  });
  revalidatePath(
    `/${subjectType === "company" ? "companies" : `${subjectType}s`}/${subjectId}`,
  );
  return { error: null };
}
