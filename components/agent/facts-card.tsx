import { and, desc, eq, inArray } from "drizzle-orm";
import { Bot } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { contactFacts } from "@/lib/db/schema";
import { BandChip, EvidencePopover } from "./evidence";

export async function FactsCard({
  workspaceId,
  contactId,
}: {
  workspaceId: string;
  contactId: string;
}) {
  const facts = await db
    .select()
    .from(contactFacts)
    .where(
      and(
        eq(contactFacts.workspaceId, workspaceId),
        eq(contactFacts.contactId, contactId),
        inArray(contactFacts.status, ["applied", "proposed"]),
      ),
    )
    .orderBy(desc(contactFacts.createdAt))
    .limit(20);

  const applied = facts.filter((f) => f.status === "applied");
  const proposed = facts.filter((f) => f.status === "proposed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" />
          Agent facts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {facts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No researched facts yet. Click Research to send the agent out.
          </p>
        )}
        {applied.map((fact) => (
          <div
            key={fact.id}
            className="flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{fact.field}</p>
              <p className="truncate text-sm">{fact.value}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              <BandChip band={fact.band} score={fact.score} />
              <EvidencePopover fact={fact} />
            </span>
          </div>
        ))}
        {proposed.length > 0 && (
          <p className="border-t pt-3 text-sm text-muted-foreground">
            {proposed.length} proposed fact{proposed.length > 1 ? "s" : ""}{" "}
            waiting in{" "}
            <Link href="/review" className="underline underline-offset-2">
              Review
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
