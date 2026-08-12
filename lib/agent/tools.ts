import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { activities, companies, contactFacts, contacts } from "@/lib/db/schema";
import {
  EVIDENCE_WEIGHTS,
  type EvidenceItem,
  FACT_FIELDS,
  scoreEvidence,
} from "./evidence";
import { logEvent } from "./queue";

const EVIDENCE_KINDS = [
  ...(Object.keys(EVIDENCE_WEIGHTS) as Array<keyof typeof EVIDENCE_WEIGHTS>),
  "contradiction",
] as const;

export type ToolContext = {
  workspaceId: string;
  contactId: string;
  taskId?: string;
};

const BLOCKED_HOSTS =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|\[?::1\]?|169\.254\.|\[?f[cde][0-9a-f]:|\[?fe80:|metadata\.|.*\.internal)$/i;

// Rejects non-public targets. Applied to the initial URL AND every redirect
// hop — following redirects blindly is a classic SSRF bypass (a public URL
// that 302s to 169.254.169.254 / an internal host).
function isBlockedTarget(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  return (
    !/^https?:$/.test(parsed.protocol) || BLOCKED_HOSTS.test(parsed.hostname)
  );
}

async function fetchPageText(url: string): Promise<string> {
  if (isBlockedTarget(url)) {
    return "Blocked: only public http(s) URLs are allowed.";
  }
  // Follow redirects manually so each hop is re-validated against the guard.
  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    res = await fetch(current, {
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "AgenticCRM-ResearchAgent/1.0" },
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (isBlockedTarget(next)) {
      return "Blocked: redirect pointed to a non-public address.";
    }
    current = next;
  }
  if (!res) return "Fetch failed: no response.";
  if (!res.ok) return `Fetch failed with status ${res.status}`;
  const html = await res.text();
  // Crude but dependency-free text extraction.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 20_000) || "Page contained no extractable text.";
}

/**
 * Saves a fact through the evidence ledger. Applies to the record only when
 * the verdict is strong AND the field is currently empty — the agent never
 * overwrites data a human (or anyone) already wrote.
 */
export async function saveFact(
  ctx: ToolContext,
  input: {
    field: (typeof FACT_FIELDS)[number];
    value: string;
    method?: string;
    evidence: EvidenceItem[];
  },
) {
  const verdict = scoreEvidence(input.evidence);

  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, ctx.contactId),
      eq(contacts.workspaceId, ctx.workspaceId),
    ),
  });
  if (!contact) return { saved: false, reason: "contact not found" };

  const currentValue = contact[input.field];
  const fieldOccupied = currentValue != null && currentValue !== "";
  const status =
    verdict.status === "applied" && !fieldOccupied ? "applied" : "proposed";

  const sourceUrl = input.evidence.find((e) => e.sourceUrl)?.sourceUrl ?? null;

  if (status === "applied") {
    await db
      .update(contactFacts)
      .set({ status: "superseded" })
      .where(
        and(
          eq(contactFacts.contactId, ctx.contactId),
          eq(contactFacts.field, input.field),
          eq(contactFacts.status, "applied"),
        ),
      );
    await db
      .update(contacts)
      .set({ [input.field]: input.value, updatedAt: new Date() })
      .where(eq(contacts.id, ctx.contactId));
  }

  await db.insert(contactFacts).values({
    workspaceId: ctx.workspaceId,
    contactId: ctx.contactId,
    field: input.field,
    value: input.value,
    score: verdict.score.toFixed(3),
    band: verdict.band,
    status,
    method: input.method ?? null,
    sourceUrl,
    evidence: input.evidence,
    taskId: ctx.taskId ?? null,
    decidedBy: status === "applied" ? "agent" : null,
    decidedAt: status === "applied" ? new Date() : null,
  });

  if (status === "applied") {
    await logActivity({
      workspaceId: ctx.workspaceId,
      type: "agent",
      actor: "agent",
      subjectType: "contact",
      subjectId: ctx.contactId,
      title: `Agent set ${input.field} = "${input.value}"`,
      body: `Band: ${verdict.band} (score ${verdict.score.toFixed(2)})${sourceUrl ? ` — ${sourceUrl}` : ""}`,
    });
  }

  if (ctx.taskId) {
    await logEvent(ctx.taskId, "fact", {
      field: input.field,
      value: input.value,
      band: verdict.band,
      score: verdict.score,
      status,
    });
  }

  return {
    saved: true,
    status,
    band: verdict.band,
    score: Number(verdict.score.toFixed(3)),
    note:
      status === "applied"
        ? "Applied to the record."
        : fieldOccupied
          ? "Proposed for review (field already has a value — never overwritten)."
          : "Proposed for human review (evidence not strong enough to auto-apply).",
  };
}

export function buildContactTools(ctx: ToolContext) {
  return {
    get_record: tool({
      description:
        "Read the contact's current CRM record: fields, company, recent activity, and applied facts. Call this first.",
      inputSchema: z.object({}),
      execute: async () => {
        const row = await db
          .select({ contact: contacts, company: companies })
          .from(contacts)
          .leftJoin(companies, eq(contacts.companyId, companies.id))
          .where(
            and(
              eq(contacts.id, ctx.contactId),
              eq(contacts.workspaceId, ctx.workspaceId),
            ),
          );
        if (!row[0]) return { error: "contact not found" };
        const { contact, company } = row[0];
        const recent = await db
          .select({
            type: activities.type,
            title: activities.title,
            body: activities.body,
            occurredAt: activities.occurredAt,
          })
          .from(activities)
          .where(
            and(
              eq(activities.subjectType, "contact"),
              eq(activities.subjectId, ctx.contactId),
            ),
          )
          .orderBy(desc(activities.occurredAt))
          .limit(10);
        return {
          // Tool outputs must be plain JSON — Date objects fail the SDK's
          // ModelMessage validation on the next step (streamText aborts).
          recentActivity: recent.map((r) => ({
            ...r,
            occurredAt: r.occurredAt.toISOString(),
          })),
          contact: {
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            role: contact.role,
            location: contact.location,
            linkedinUrl: contact.linkedinUrl,
            notes: contact.notes,
          },
          company: company
            ? {
                name: company.name,
                domain: company.domain,
                website: company.website,
                industry: company.industry,
              }
            : null,
        };
      },
    }),

    save_fact: tool({
      description:
        "Save a researched fact about the contact with the evidence you observed. The evidence ledger decides whether it auto-applies or goes to human review.",
      inputSchema: z.object({
        field: z.enum(FACT_FIELDS),
        value: z.string().min(1),
        method: z
          .string()
          .optional()
          .describe("Short description of how you found this"),
        evidence: z
          .array(
            z.object({
              kind: z.enum(EVIDENCE_KINDS),
              sourceUrl: z.string().optional(),
              note: z.string().optional(),
            }),
          )
          .min(1),
      }),
      execute: (input) => saveFact(ctx, input),
    }),

    fetch_url: tool({
      description:
        "Fetch a public web page and return its readable text (capped at 20k chars).",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        try {
          return await fetchPageText(url);
        } catch (e) {
          return `Fetch error: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
    }),

    web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }),
  };
}
