import type { DealStage } from "@/lib/db/schema";

// Single source for deal-stage order and display labels. Kept as literals
// (not a value-import of the pgEnum) so client components can use it without
// pulling the Drizzle schema into the browser bundle. The `satisfies` clauses
// tie both to the DealStage union: add a stage to the enum and STAGE_LABELS
// fails to compile until it is covered here.
export const STAGE_ORDER = [
  "lead",
  "qualified",
  "proposal",
  "won",
  "lost",
] as const satisfies readonly DealStage[];

export const STAGE_LABELS = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
} satisfies Record<DealStage, string>;
