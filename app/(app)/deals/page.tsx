import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { DealDialog } from "@/components/crm/deal-dialog";
import { PageHeader } from "@/components/crm/page-header";
import { StageSelect } from "@/components/crm/stage-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { convertToBase, getRatesToBase } from "@/lib/currency";
import { db } from "@/lib/db";
import { companies, type DealStage, deals } from "@/lib/db/schema";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Deals — Agentic CRM" };

const STAGES: Array<{ key: DealStage; label: string }> = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default async function DealsPage() {
  const workspace = await ensureWorkspace();

  const [rows, companyOptions] = await Promise.all([
    db
      .select({ deal: deals, companyName: companies.name })
      .from(deals)
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .where(eq(deals.workspaceId, workspace.id))
      .orderBy(desc(deals.updatedAt))
      .limit(200),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.workspaceId, workspace.id))
      .orderBy(companies.name),
  ]);

  // Cards show each deal's native currency; column totals convert to the
  // workspace base currency at aggregation time.
  const base = workspace.baseCurrency;
  const rates = await getRatesToBase(
    base,
    rows.map(({ deal }) => deal.currency),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Deals" description="Pipeline by stage.">
        <DealDialog
          companies={companyOptions}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New deal
            </Button>
          }
        />
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map(({ key, label }) => {
          const stageDeals = rows.filter(({ deal }) => deal.stage === key);
          const total = stageDeals.reduce(
            (sum, { deal }) =>
              sum + convertToBase(deal.amount, deal.currency, base, rates),
            0,
          );
          return (
            <div
              key={key}
              className="flex flex-col rounded-xl border bg-muted/25 p-2"
            >
              <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium">{label}</h2>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {stageDeals.length}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatMoney(total, base)}
                </span>
              </div>
              <div className="space-y-2">
                {stageDeals.map(({ deal, companyName }) => (
                  <Card
                    key={deal.id}
                    className="gap-0 py-3 shadow-xs transition-shadow hover:shadow-sm"
                  >
                    <CardContent className="space-y-2 px-3">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="block text-sm font-medium leading-snug hover:underline"
                      >
                        {deal.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {companyName ?? "No company"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tabular-nums">
                          {formatMoney(deal.amount, deal.currency)}
                        </span>
                        <StageSelect dealId={deal.id} stage={deal.stage} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <p className="rounded-lg border border-dashed bg-transparent p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
