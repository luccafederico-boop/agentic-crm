"use client";

import { useTransition } from "react";
import { moveDealStage } from "@/actions/deals";
import type { DealStage } from "@/lib/db/schema";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/stages";

export function StageSelect({
  dealId,
  stage,
}: {
  dealId: string;
  stage: DealStage;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stage}
      disabled={pending}
      aria-label="Deal stage"
      className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
      onChange={(e) => {
        const next = e.target.value as DealStage;
        startTransition(() => moveDealStage(dealId, next));
      }}
    >
      {STAGE_ORDER.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
