import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EvidenceItem } from "@/lib/agent/evidence";
import type { ContactFact } from "@/lib/db/schema";

const BAND_STYLES: Record<string, string> = {
  verified:
    "border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400",
  probable:
    "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  possible: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function BandChip({ band, score }: { band: string; score: string }) {
  return (
    <Badge variant="outline" className={BAND_STYLES[band] ?? ""}>
      {band} · {Number(score).toFixed(2)}
    </Badge>
  );
}

export function EvidenceList({ fact }: { fact: ContactFact }) {
  const items = (fact.evidence ?? []) as EvidenceItem[];
  return (
    <ul className="space-y-2 text-xs">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: evidence is an immutable snapshot, never reordered
        <li key={`${item.kind}-${i}`} className="space-y-0.5">
          <span
            className={
              item.kind === "contradiction"
                ? "font-medium text-destructive"
                : "font-medium"
            }
          >
            {item.kind}
          </span>
          {item.note && <p className="text-muted-foreground">{item.note}</p>}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-muted-foreground underline underline-offset-2"
            >
              {item.sourceUrl}
            </a>
          )}
        </li>
      ))}
      {fact.method && (
        <li className="border-t pt-2 text-muted-foreground">
          Method: {fact.method}
        </li>
      )}
    </ul>
  );
}

export function EvidencePopover({ fact }: { fact: ContactFact }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Show evidence"
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="mb-2 text-sm font-medium">Evidence</p>
        <EvidenceList fact={fact} />
      </PopoverContent>
    </Popover>
  );
}
