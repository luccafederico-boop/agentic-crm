import { and, desc, eq } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCompany } from "@/actions/companies";
import { CompanyDialog } from "@/components/crm/company-dialog";
import { CompanyLogo } from "@/components/crm/company-logo";
import { ContactDialog } from "@/components/crm/contact-dialog";
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
import { activities, companies, contacts, deals } from "@/lib/db/schema";
import { formatMoney } from "@/lib/format";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await ensureWorkspace();

  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, id), eq(companies.workspaceId, workspace.id)),
  });
  if (!company) notFound();

  const [companyContacts, companyDeals, timeline, companyOptions] =
    await Promise.all([
      db
        .select()
        .from(contacts)
        .where(eq(contacts.companyId, company.id))
        .orderBy(contacts.name),
      db
        .select()
        .from(deals)
        .where(eq(deals.companyId, company.id))
        .orderBy(desc(deals.updatedAt)),
      db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.workspaceId, workspace.id),
            eq(activities.subjectType, "company"),
            eq(activities.subjectId, company.id),
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

  const deleteAction = deleteCompany.bind(null, company.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={company.name}
        description={company.industry ?? undefined}
      >
        <CompanyDialog
          company={company}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          }
        />
        <DeleteButton
          label="Delete"
          confirmMessage={`Delete company "${company.name}"? Its contacts and deals will be kept but unlinked.`}
          action={deleteAction}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CompanyLogo
                  name={company.name}
                  domain={company.domain}
                  logoPath={company.logoPath}
                />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd>{company.domain ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="break-words">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {company.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd>{company.size ?? "—"}</dd>
                </div>
                {company.notes && (
                  <div>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{company.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Contacts ({companyContacts.length})
              </CardTitle>
              <ContactDialog
                companies={companyOptions}
                defaultCompanyId={company.id}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" />
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {companyContacts.length === 0 && (
                <p className="text-sm text-muted-foreground">No contacts.</p>
              )}
              {companyContacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="block text-sm hover:underline"
                >
                  {c.name}
                  {c.role && (
                    <span className="text-muted-foreground"> — {c.role}</span>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Deals ({companyDeals.length})
              </CardTitle>
              <DealDialog
                companies={companyOptions}
                defaultCompanyId={company.id}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" />
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {companyDeals.length === 0 && (
                <p className="text-sm text-muted-foreground">No deals.</p>
              )}
              {companyDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between gap-2 text-sm hover:underline"
                >
                  <span className="truncate">{d.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{d.stage}</Badge>
                    <span className="text-muted-foreground">
                      {formatMoney(d.amount, d.currency)}
                    </span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <NoteForm subjectType="company" subjectId={company.id} />
            <Timeline items={timeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
