import {
  Building2,
  CircleCheck,
  Handshake,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { QuickSwitcher } from "@/components/quick-switcher";
import { Button } from "@/components/ui/button";
import { ensureWorkspace } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/review", label: "Review", icon: CircleCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await ensureWorkspace();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <p className="text-sm font-semibold">Agentic CRM</p>
          <p className="truncate text-xs text-muted-foreground">
            {workspace.name}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Press <kbd className="rounded border px-1">Ctrl</kbd>+
            <kbd className="rounded border px-1">K</kbd> to search
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-2">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      <QuickSwitcher />
    </div>
  );
}
