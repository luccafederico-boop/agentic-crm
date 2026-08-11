"use client";

import {
  Building2,
  CircleCheck,
  Handshake,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { type QuickSearchResult, quickSearch } from "@/actions/search";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/review", label: "Review", icon: CircleCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const EMPTY: QuickSearchResult = { contacts: [], companies: [], deals: [] };

export function QuickSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickSearchResult>(EMPTY);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await quickSearch(query));
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasRecords =
    results.contacts.length + results.companies.length + results.deals.length >
    0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
      title="Quick switcher"
      description="Search contacts, companies, deals and pages"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search contacts, companies, deals…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2
              ? "Type at least 2 characters to search records."
              : "No results."}
          </CommandEmpty>

          {results.contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {results.contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contact-${c.id}`}
                  onSelect={() => go(`/contacts/${c.id}`)}
                >
                  <Users className="size-4" />
                  {c.name}
                  {c.email && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {c.email}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.companies.length > 0 && (
            <CommandGroup heading="Companies">
              {results.companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`company-${c.id}`}
                  onSelect={() => go(`/companies/${c.id}`)}
                >
                  <Building2 className="size-4" />
                  {c.name}
                  {c.domain && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {c.domain}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.deals.length > 0 && (
            <CommandGroup heading="Deals">
              {results.deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`deal-${d.id}`}
                  onSelect={() => go(`/deals/${d.id}`)}
                >
                  <Handshake className="size-4" />
                  {d.title}
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {d.stage}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {hasRecords && <CommandSeparator />}

          <CommandGroup heading="Pages">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <CommandItem
                key={href}
                value={`page-${href}`}
                onSelect={() => go(href)}
              >
                <Icon className="size-4" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
