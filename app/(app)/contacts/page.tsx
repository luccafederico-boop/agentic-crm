import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ContactDialog } from "@/components/crm/contact-dialog";
import { PageHeader } from "@/components/crm/page-header";
import { SearchForm } from "@/components/crm/search-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, contacts } from "@/lib/db/schema";

export const metadata = { title: "Contacts — Agentic CRM" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const workspace = await ensureWorkspace();

  const [rows, companyOptions] = await Promise.all([
    db
      .select({
        contact: contacts,
        companyName: companies.name,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(
        and(
          eq(contacts.workspaceId, workspace.id),
          q
            ? or(
                ilike(contacts.name, `%${q}%`),
                ilike(contacts.email, `%${q}%`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(contacts.updatedAt))
      .limit(100),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.workspaceId, workspace.id))
      .orderBy(companies.name),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description="People in your network.">
        <ContactDialog
          companies={companyOptions}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New contact
            </Button>
          }
        />
      </PageHeader>
      <SearchForm placeholder="Search by name or email…" defaultValue={q} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-muted-foreground"
              >
                {q ? "No contacts match your search." : "No contacts yet."}
              </TableCell>
            </TableRow>
          )}
          {rows.map(({ contact, companyName }) => (
            <TableRow key={contact.id}>
              <TableCell>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="font-medium hover:underline"
                >
                  {contact.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.email ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.role ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {companyName ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
