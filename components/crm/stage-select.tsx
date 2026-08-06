"use client";

import { useTransition } from "react";
import { moveDealStage } from "@/actions/deals";
import type { DealStage } from "@/lib/db/schema";

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];

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
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
