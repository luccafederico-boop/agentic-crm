import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";

export const metadata = { title: "Review — Agentic CRM" };

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        description="Facts the agent proposed but could not verify strongly enough to apply."
      />
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <CircleCheck className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nothing to review</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          When the research agent lands in Phase 2, weakly-evidenced facts will
          wait here for your approval.
        </p>
      </div>
    </div>
  );
}
