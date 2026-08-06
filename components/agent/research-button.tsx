"use client";

import { Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { researchContact } from "@/actions/agent";
import { Button } from "@/components/ui/button";

export function ResearchButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await researchContact(contactId);
          if (result.queued) {
            toast.success(result.message, {
              description: "Facts will appear on the record within seconds.",
            });
          } else {
            toast.info(result.message);
          }
        })
      }
    >
      <Sparkles className="size-4" />
      {pending ? "Queuing…" : "Research"}
    </Button>
  );
}
