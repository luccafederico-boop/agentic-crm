import { updateBaseCurrency } from "@/actions/workspace";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";
import { CURRENCIES } from "@/lib/format";

export const metadata = { title: "Settings — Agentic CRM" };

export default async function SettingsPage() {
  const workspace = await ensureWorkspace();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>Basic workspace information.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{workspace.name}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base currency</CardTitle>
          <CardDescription>
            Reporting currency for dashboard and pipeline totals. Deals keep the
            currency they were created in; totals convert using daily ECB rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateBaseCurrency} className="flex items-center gap-3">
            <select
              name="baseCurrency"
              defaultValue={workspace.baseCurrency}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google account</CardTitle>
          <CardDescription>
            Gmail and Calendar sync arrives in Phase 5.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
