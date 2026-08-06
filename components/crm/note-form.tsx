"use client";

import { useActionState } from "react";
import { addNote } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/forms";

export function NoteForm({
  subjectType,
  subjectId,
}: {
  subjectType: "contact" | "company" | "deal";
  subjectId: string;
}) {
  const [state, formAction, pending] = useActionState(
    addNote,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <Textarea name="body" placeholder="Add a note…" rows={3} required />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
