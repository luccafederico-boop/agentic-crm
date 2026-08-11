import { and, desc, eq, ilike } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { CompanyDialog } from "@/components/crm/company-dialog";
import { CompanyLogo } from "@/components/crm/company-logo";
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
import { companies } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Companies — Agentic CRM" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const workspace = await ensureWorkspace();

  const rows = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.workspaceId, workspace.id),
        q ? ilike(companies.name, `%${q}%`) : undefined,
      ),
    )
    .orderBy(desc(companies.updatedAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Companies" description="Accounts you work with.">
        <CompanyDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New company
            </Button>
          }
        />
      </PageHeader>
      <SearchForm placeholder="Search companies…" defaultValue={q} />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-muted-foreground"
                >
                  {q ? "No companies match your search." : "No companies yet."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((company) => (
              <TableRow key={company.id}>
                <TableCell>
                  <Link
                    href={`/companies/${company.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    <CompanyLogo
                      name={company.name}
                      domain={company.domain}
                      logoPath={company.logoPath}
                    />
                    {company.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {company.domain ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {company.industry ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(company.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
