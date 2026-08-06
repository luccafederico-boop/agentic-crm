import {
  Bot,
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import type { Activity } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

const TYPE_ICONS = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  system: RefreshCw,
  agent: Bot,
} as const;

export function Timeline({ items }: { items: Activity[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const Icon = TYPE_ICONS[item.type] ?? StickyNote;
        return (
          <li key={item.id} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted/50">
              <Icon className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                <time className="text-xs text-muted-foreground">
                  {formatDateTime(item.occurredAt)}
                </time>
              </div>
              {item.body && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.body}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
