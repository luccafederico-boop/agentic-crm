"use client";

import { useActionState, useState } from "react";
import { saveCompany } from "@/actions/companies";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Company } from "@/lib/db/schema";
import { type FormState, initialFormState } from "@/lib/forms";

export function CompanyDialog({
  company,
  trigger,
}: {
  company?: Company;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await saveCompany(prev, formData);
      if (!result.error) setOpen(false);
      return result;
    },
    initialFormState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "New company"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {company && <input type="hidden" name="id" value={company.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Name *</Label>
            <Input
              id="company-name"
              name="name"
              defaultValue={company?.name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company-domain">Domain</Label>
              <Input
                id="company-domain"
                name="domain"
                placeholder="acme.com"
                defaultValue={company?.domain ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                name="website"
                placeholder="https://acme.com"
                defaultValue={company?.website ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company-industry">Industry</Label>
              <Input
                id="company-industry"
                name="industry"
                defaultValue={company?.industry ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-size">Size</Label>
              <Input
                id="company-size"
                name="size"
                placeholder="1-10, 11-50…"
                defaultValue={company?.size ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-notes">Notes</Label>
            <Textarea
              id="company-notes"
              name="notes"
              rows={3}
              defaultValue={company?.notes ?? ""}
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
