"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { CURRENCIES } from "@/lib/format";

// Changing the base currency only changes the reporting currency: deals keep
// their native currency and totals re-convert at aggregation time.
export async function updateBaseCurrency(formData: FormData) {
  const workspace = await ensureWorkspace();
  const value = String(formData.get("baseCurrency") ?? "");
  if (!(CURRENCIES as readonly string[]).includes(value)) return;

  await db
    .update(workspaces)
    .set({ baseCurrency: value })
    .where(eq(workspaces.id, workspace.id));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/deals");
}
