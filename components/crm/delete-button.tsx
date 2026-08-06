"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  label,
  confirmMessage,
  action,
}: {
  label: string;
  confirmMessage: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          startTransition(() => action());
        }
      }}
    >
      <Trash2 className="size-4" />
      {label}
    </Button>
  );
}
