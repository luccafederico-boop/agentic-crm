import { and, count, eq } from "drizzle-orm";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { QuickSwitcher } from "@/components/quick-switcher";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ensureWorkspace, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactFacts } from "@/lib/db/schema";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const workspace = await ensureWorkspace();
  const [pending] = await db
    .select({ count: count() })
    .from(contactFacts)
    .where(
      and(
        eq(contactFacts.workspaceId, workspace.id),
        eq(contactFacts.status, "proposed"),
      ),
    );

  return (
    <SidebarProvider>
      <AppSidebar
        workspaceName={workspace.name}
        userEmail={user.email ?? ""}
        reviewCount={pending?.count ?? 0}
      />
      <SidebarInset>
        <AppTopbar />
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
      <QuickSwitcher />
    </SidebarProvider>
  );
}
