import { eq } from "drizzle-orm";
import { CalendarClock, Mail, RefreshCw, Unplug } from "lucide-react";
import { disconnectGoogle, syncGoogleNow } from "@/actions/google";
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
import { db } from "@/lib/db";
import { googleAccounts } from "@/lib/db/schema";
import { CURRENCIES, formatDateTime } from "@/lib/format";

export const metadata = { title: "Settings — Agentic CRM" };

const GOOGLE_MESSAGES: Record<string, { text: string; error: boolean }> = {
  connected: {
    text: "Google account connected — first sync queued.",
    error: false,
  },
  denied: { text: "Google connection was cancelled.", error: true },
  state_mismatch: {
    text: "Connection expired or was tampered with — try again.",
    error: true,
  },
  error: { text: "Google connection failed — try again.", error: true },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  const workspace = await ensureWorkspace();
  const account = await db.query.googleAccounts.findFirst({
    where: eq(googleAccounts.workspaceId, workspace.id),
  });
  const flash = google ? GOOGLE_MESSAGES[google] : undefined;

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
            Gmail and Calendar sync: recent emails and meetings with your CRM
            contacts appear on their timelines. Read-only scopes; the refresh
            token is stored encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flash && (
            <p
              className={`text-sm ${flash.error ? "text-destructive" : "text-muted-foreground"}`}
            >
              {flash.text}
            </p>
          )}
          {account ? (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <dd>{account.email}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <dd className="text-muted-foreground">
                    Last sync: {formatDateTime(account.lastSyncAt)}
                  </dd>
                </div>
                {account.lastSyncError && (
                  <dd className="text-destructive">
                    Last sync error: {account.lastSyncError}
                  </dd>
                )}
              </dl>
              <div className="flex gap-2">
                <form action={syncGoogleNow}>
                  <Button type="submit" size="sm" variant="outline">
                    <RefreshCw className="size-4" />
                    Sync now
                  </Button>
                </form>
                <form action={disconnectGoogle}>
                  <Button type="submit" size="sm" variant="ghost">
                    <Unplug className="size-4" />
                    Disconnect
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <Button size="sm" render={<a href="/api/google/oauth/start" />}>
              Connect Google
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
