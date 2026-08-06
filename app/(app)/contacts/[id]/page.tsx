import type { UIMessage } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContact } from "@/actions/contacts";
import { ChatPanel } from "@/components/agent/chat-panel";
import { FactsCard } from "@/components/agent/facts-card";
import { ResearchButton } from "@/components/agent/research-button";
import { TaskTrace } from "@/components/agent/task-trace";
import { ContactDialog } from "@/components/crm/contact-dialog";
import { DeleteButton } from "@/components/crm/delete-button";
import { NoteForm } from "@/components/crm/note-form";
import { PageHeader } from "@/components/crm/page-header";
import { Timeline } from "@/components/crm/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  agentMessages,
  companies,
  contacts,
} from "@/lib/db/schema";

// Server Actions here trigger the agent drain in after() — allow time for it.
export const maxDuration = 60;

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await ensureWorkspace();

  const [row] = await db
    .select({ contact: contacts, company: companies })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)));
  if (!row) notFound();
  const { contact, company } = row;

  const [timeline, companyOptions, chatRows] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.workspaceId, workspace.id),
          eq(activities.subjectType, "contact"),
          eq(activities.subjectId, contact.id),
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(50),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.workspaceId, workspace.id))
      .orderBy(companies.name),
    db
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.workspaceId, workspace.id),
          eq(agentMessages.subjectType, "contact"),
          eq(agentMessages.subjectId, contact.id),
        ),
      )
      .orderBy(asc(agentMessages.createdAt))
      .limit(50),
  ]);

  const initialChat: UIMessage[] = chatRows.map((m) => ({
    id: m.id,
    role: m.role as UIMessage["role"],
    parts: m.content as UIMessage["parts"],
  }));

  const deleteAction = deleteContact.bind(null, contact.id);

  const fields: Array<[string, React.ReactNode]> = [
    ["Email", contact.email ?? "—"],
    ["Phone", contact.phone ?? "—"],
    ["Role", contact.role ?? "—"],
    [
      "Company",
      company ? (
        <Link
          key="company"
          href={`/companies/${company.id}`}
          className="hover:underline"
        >
          {company.name}
        </Link>
      ) : (
        "—"
      ),
    ],
    [
      "LinkedIn",
      contact.linkedinUrl ? (
        <a
          key="li"
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {contact.linkedinUrl}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Location", contact.location ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={contact.name} description={contact.role ?? undefined}>
        <ResearchButton contactId={contact.id} />
        <ChatPanel
          subjectType="contact"
          subjectId={contact.id}
          subjectName={contact.name}
          initialMessages={initialChat}
        />
        <ContactDialog
          contact={contact}
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
          confirmMessage={`Delete contact "${contact.name}"? This cannot be undone.`}
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
                {fields.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
                {contact.notes && (
                  <div>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{contact.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <FactsCard workspaceId={workspace.id} contactId={contact.id} />
          <TaskTrace subjectType="contact" subjectId={contact.id} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <NoteForm subjectType="contact" subjectId={contact.id} />
            <Timeline items={timeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
