import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { chatSystemPrompt } from "@/lib/agent/prompts";
import { buildContactTools } from "@/lib/agent/tools";
import { getUserWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentMessages, contacts } from "@/lib/db/schema";
import { chatMessagesRemaining } from "@/lib/limits";

export const maxDuration = 60;

const MODEL_ID = process.env.AGENT_MODEL ?? "claude-sonnet-5";

export async function POST(req: Request) {
  const auth = await getUserWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { workspace } = auth;

  const body = (await req.json()) as {
    messages: UIMessage[];
    subjectType?: string;
    subjectId?: string;
  };

  if (body.subjectType !== "contact" || !body.subjectId) {
    return NextResponse.json({ error: "unsupported subject" }, { status: 400 });
  }
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, body.subjectId),
      eq(contacts.workspaceId, workspace.id),
    ),
  });
  if (!contact) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if ((await chatMessagesRemaining(workspace.id)) <= 0) {
    return NextResponse.json(
      {
        error:
          "Daily chat limit reached for this workspace — try again tomorrow.",
      },
      { status: 429 },
    );
  }

  const subjectId = body.subjectId;

  const result = streamText({
    model: anthropic(MODEL_ID),
    system: chatSystemPrompt("contact"),
    messages: await convertToModelMessages(body.messages),
    tools: buildContactTools({
      workspaceId: workspace.id,
      contactId: subjectId,
    }),
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: body.messages,
    onFinish: async ({ responseMessage }) => {
      // Persist the last user turn and the assistant reply.
      const lastUser = [...body.messages]
        .reverse()
        .find((m) => m.role === "user");
      const rows = [lastUser, responseMessage]
        .filter((m): m is UIMessage => Boolean(m))
        .map((m) => ({
          workspaceId: workspace.id,
          subjectType: "contact",
          subjectId,
          role: m.role,
          content: m.parts,
        }));
      if (rows.length) {
        await db.insert(agentMessages).values(rows);
      }
    },
  });
}
