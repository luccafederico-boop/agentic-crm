import { PageHeader } from "@/components/crm/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureWorkspace } from "@/lib/auth";

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
            <div>
              <dt className="text-muted-foreground">Base currency</dt>
              <dd>
                {workspace.baseCurrency}
                <span className="ml-2 text-xs text-muted-foreground">
                  (configurable in Phase 4)
                </span>
              </dd>
            </div>
          </dl>
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
