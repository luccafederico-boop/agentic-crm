import { and, desc, eq } from "drizzle-orm";
import { Check, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { approveFact, dismissFact } from "@/actions/agent";
import { BandChip, EvidenceList } from "@/components/agent/fact-card";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactFacts, contacts } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Review — Agentic CRM" };

export default async function ReviewPage() {
  const workspace = await ensureWorkspace();

  const proposed = await db
    .select({ fact: contactFacts, contactName: contacts.name })
    .from(contactFacts)
    .innerJoin(contacts, eq(contactFacts.contactId, contacts.id))
    .where(
      and(
        eq(contactFacts.workspaceId, workspace.id),
        eq(contactFacts.status, "proposed"),
      ),
    )
    .orderBy(desc(contactFacts.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        description="Facts the agent proposed but could not verify strongly enough to apply."
      />

      {proposed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <CircleCheck className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing to review</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Run Research on a contact — weakly-evidenced findings will wait here
            for your judgment.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {proposed.map(({ fact, contactName }) => {
            const approve = approveFact.bind(null, fact.id);
            const dismiss = dismissFact.bind(null, fact.id);
            return (
              <Card key={fact.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/contacts/${fact.contactId}`}
                        className="hover:underline"
                      >
                        {contactName}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">
                        {fact.field}:
                      </span>{" "}
                      {fact.value}
                    </p>
                  </div>
                  <BandChip band={fact.band} score={fact.score} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <EvidenceList fact={fact} />
                  <div className="flex items-center justify-between border-t pt-3">
                    <time className="text-xs text-muted-foreground">
                      {formatDateTime(fact.createdAt)}
                    </time>
                    <div className="flex gap-2">
                      <form action={dismiss}>
                        <Button type="submit" variant="outline" size="sm">
                          <X className="size-4" />
                          Dismiss
                        </Button>
                      </form>
                      <form action={approve}>
                        <Button type="submit" size="sm">
                          <Check className="size-4" />
                          Approve
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
