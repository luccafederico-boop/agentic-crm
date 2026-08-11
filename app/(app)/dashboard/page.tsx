import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import {
  Bot,
  Building2,
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock,
  Handshake,
  Loader2,
  Mail,
  Phone,
  StickyNote,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  PipelineBar,
  type PipelinePoint,
} from "@/components/charts/pipeline-bar";
import { WonArea, type WonPoint } from "@/components/charts/won-area";
import { PageHeader } from "@/components/crm/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { convertToBase, getRatesToBase } from "@/lib/currency";
import { db } from "@/lib/db";
import {
  activities,
  agentTasks,
  companies,
  contacts,
  deals,
} from "@/lib/db/schema";
import { formatMoney, formatRelative } from "@/lib/format";

export const metadata = { title: "Dashboard — Agentic CRM" };

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const ACTIVITY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  system: Zap,
  agent: Bot,
};

const SUBJECT_PATHS: Record<string, string> = {
  contact: "/contacts",
  company: "/companies",
  deal: "/deals",
};

export default async function DashboardPage() {
  const workspace = await ensureWorkspace();
  const wsFilter = eq(deals.workspaceId, workspace.id);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const [stageRows, wonRows, recent, taskRows, [contactCount], [companyCount]] =
    await Promise.all([
      db
        .select({
          stage: deals.stage,
          currency: deals.currency,
          total: sum(deals.amount),
          count: count(),
        })
        .from(deals)
        .where(wsFilter)
        .groupBy(deals.stage, deals.currency),
      db
        .select({
          month: sql<string>`to_char(${deals.updatedAt}, 'YYYY-MM')`,
          currency: deals.currency,
          total: sum(deals.amount),
          count: count(),
        })
        .from(deals)
        .where(
          and(
            wsFilter,
            eq(deals.stage, "won"),
            gte(deals.updatedAt, sixMonthsAgo),
          ),
        )
        .groupBy(sql`to_char(${deals.updatedAt}, 'YYYY-MM')`, deals.currency),
      db
        .select()
        .from(activities)
        .where(eq(activities.workspaceId, workspace.id))
        .orderBy(desc(activities.occurredAt))
        .limit(8),
      db
        .select({ status: agentTasks.status, count: count() })
        .from(agentTasks)
        .where(eq(agentTasks.workspaceId, workspace.id))
        .groupBy(agentTasks.status),
      db
        .select({ count: count() })
        .from(contacts)
        .where(eq(contacts.workspaceId, workspace.id)),
      db
        .select({ count: count() })
        .from(companies)
        .where(eq(companies.workspaceId, workspace.id)),
    ]);

  // Deals keep their native currency; totals convert to the workspace base
  // currency at aggregation time using lazily-cached daily rates.
  const base = workspace.baseCurrency;
  const rates = await getRatesToBase(base, [
    ...stageRows.map((r) => r.currency),
    ...wonRows.map((r) => r.currency),
  ]);

  const pipeline: PipelinePoint[] = (
    ["lead", "qualified", "proposal", "won", "lost"] as const
  ).map((stage) => {
    const rows = stageRows.filter((r) => r.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      total: rows.reduce(
        (s, r) => s + convertToBase(r.total, r.currency, base, rates),
        0,
      ),
      count: rows.reduce((s, r) => s + r.count, 0),
    };
  });

  const openPipelineValue = pipeline
    .filter((p) => !["won", "lost"].includes(p.stage))
    .reduce((s, p) => s + p.total, 0);

  const won: WonPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = wonRows.filter((r) => r.month === key);
    won.push({
      month: key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      total: rows.reduce(
        (s, r) => s + convertToBase(r.total, r.currency, base, rates),
        0,
      ),
      count: rows.reduce((s, r) => s + r.count, 0),
    });
  }

  const taskCount = (status: string) =>
    taskRows.find((r) => r.status === status)?.count ?? 0;

  const stats = [
    { label: "Contacts", value: String(contactCount.count), icon: Users },
    { label: "Companies", value: String(companyCount.count), icon: Building2 },
    {
      label: "Open pipeline",
      value: formatMoney(openPipelineValue, base),
      icon: Handshake,
    },
    {
      label: "Agent runs done",
      value: String(taskCount("done")),
      icon: Bot,
    },
  ];

  const queueTiles = [
    { label: "Queued", value: taskCount("queued"), icon: Clock },
    { label: "Running", value: taskCount("running"), icon: Loader2 },
    { label: "Done", value: taskCount("done"), icon: CircleCheck },
    { label: "Failed", value: taskCount("failed"), icon: CircleX },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Pipeline and agent activity at a glance. Amounts converted to ${base}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="gap-2 py-4">
            <CardContent className="space-y-1.5 px-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <Icon className="size-4 text-muted-foreground/70" />
              </div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <CardDescription>Total deal value in each stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineBar data={pipeline} currency={base} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Won deals</CardTitle>
            <CardDescription>Closed-won value, last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <WonArea data={won} currency={base} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>
              Everything the team, the agent and sync did lately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-1">
                {recent.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? Zap;
                  const href = SUBJECT_PATHS[a.subjectType]
                    ? `${SUBJECT_PATHS[a.subjectType]}/${a.subjectId}`
                    : null;
                  const row = (
                    <>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                        <Icon className="size-3.5 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {a.title}
                        {a.actor !== "user" && (
                          <span className="ml-2 rounded-sm bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {a.actor}
                          </span>
                        )}
                      </span>
                      <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatRelative(a.occurredAt)}
                      </time>
                    </>
                  );
                  return (
                    <li key={a.id}>
                      {href ? (
                        <Link
                          href={href}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-2 py-1.5">
                          {row}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent queue</CardTitle>
            <CardDescription>Task counts by status.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {queueTiles.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Icon className="size-3.5 text-muted-foreground/70" />
                </div>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
