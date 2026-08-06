import { and, desc, eq, notInArray } from "drizzle-orm";
import { Pencil, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteDeal,
  linkContactToDeal,
  unlinkContactFromDeal,
} from "@/actions/deals";
import { DealDialog } from "@/components/crm/deal-dialog";
import { DeleteButton } from "@/components/crm/delete-button";
import { NoteForm } from "@/components/crm/note-form";
import { PageHeader } from "@/components/crm/page-header";
import { Timeline } from "@/components/crm/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  companies,
  contacts,
  dealContacts,
  deals,
} from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/format";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await ensureWorkspace();

  const [row] = await db
    .select({ deal: deals, company: companies })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .where(and(eq(deals.id, id), eq(deals.workspaceId, workspace.id)));
  if (!row) notFound();
  const { deal, company } = row;

  const linked = await db
    .select({ contact: contacts })
    .from(dealContacts)
    .innerJoin(contacts, eq(dealContacts.contactId, contacts.id))
    .where(eq(dealContacts.dealId, deal.id));
  const linkedIds = linked.map(({ contact }) => contact.id);

  const [available, timeline, companyOptions] = await Promise.all([
    db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, workspace.id),
          linkedIds.length > 0 ? notInArray(contacts.id, linkedIds) : undefined,
        ),
      )
      .orderBy(contacts.name),
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.workspaceId, workspace.id),
          eq(activities.subjectType, "deal"),
          eq(activities.subjectId, deal.id),
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(50),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.workspaceId, workspace.id))
      .orderBy(companies.name),
  ]);

  const deleteAction = deleteDeal.bind(null, deal.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={deal.title}
        description={company?.name ?? "No company"}
      >
        <Badge variant="outline" className="capitalize">
          {deal.stage}
        </Badge>
        <DealDialog
          deal={deal}
          companies={companyOptions}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          }
        />
        <DeleteButton
          label="Delete"
          confirmMessage={`Delete deal "${deal.title}"? This cannot be undone.`}
          action={deleteAction}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-lg font-semibold">
                    {formatMoney(deal.amount, deal.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expected close</dt>
                  <dd>{formatDate(deal.expectedClose)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Company</dt>
                  <dd>
                    {company ? (
                      <Link
                        href={`/companies/${company.id}`}
                        className="hover:underline"
                      >
                        {company.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {deal.notes && (
                  <div>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{deal.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                People ({linked.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linked.map(({ contact }) => {
                const unlink = unlinkContactFromDeal.bind(
                  null,
                  deal.id,
                  contact.id,
                );
                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-sm hover:underline"
                    >
                      {contact.name}
                    </Link>
                    <form action={unlink}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Unlink ${contact.name}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                );
              })}
              {available.length > 0 && (
                <form action={linkContactToDeal} className="flex gap-2">
                  <input type="hidden" name="dealId" value={deal.id} />
                  <select
                    name="contactId"
                    className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                    aria-label="Contact to link"
                  >
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" size="sm">
                    Link
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <NoteForm subjectType="deal" subjectId={deal.id} />
            <Timeline items={timeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
