import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";

type LogActivityInput = {
  workspaceId: string;
  type: (typeof activities.type.enumValues)[number];
  actor?: (typeof activities.actor.enumValues)[number];
  subjectType: "contact" | "company" | "deal";
  subjectId: string;
  title: string;
  body?: string | null;
};

export async function logActivity(input: LogActivityInput) {
  await db.insert(activities).values({
    workspaceId: input.workspaceId,
    type: input.type,
    actor: input.actor ?? "user",
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    title: input.title,
    body: input.body ?? null,
  });
}
