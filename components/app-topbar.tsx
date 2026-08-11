"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const SECTION_LABELS: Array<[string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/contacts", "Contacts"],
  ["/companies", "Companies"],
  ["/deals", "Deals"],
  ["/review", "Review"],
  ["/settings", "Settings"],
];

export function AppTopbar() {
  const pathname = usePathname();
  const section = SECTION_LABELS.find(([href]) => pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-4" />
      <span className="text-sm font-medium">{section?.[1] ?? ""}</span>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("quick-switcher:open"))}
        className="ml-auto flex h-8 w-full max-w-56 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-56"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left text-xs">Search…</span>
        <kbd className="pointer-events-none rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </button>
    </header>
  );
}
