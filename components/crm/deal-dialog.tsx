"use client";

import { useActionState, useState } from "react";
import { saveDeal } from "@/actions/deals";
import type { CompanyOption } from "@/components/crm/contact-dialog";
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
import type { Deal } from "@/lib/db/schema";
import { CURRENCIES } from "@/lib/format";
import { type FormState, initialFormState } from "@/lib/forms";

const STAGES = ["lead", "qualified", "proposal", "won", "lost"] as const;

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

export function DealDialog({
  deal,
  companies,
  defaultCompanyId,
  trigger,
}: {
  deal?: Deal;
  companies: CompanyOption[];
  defaultCompanyId?: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await saveDeal(prev, formData);
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
          <DialogTitle>{deal ? "Edit deal" : "New deal"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {deal && <input type="hidden" name="id" value={deal.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Title *</Label>
            <Input
              id="deal-title"
              name="title"
              defaultValue={deal?.title}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-company">Company</Label>
              <select
                id="deal-company"
                name="companyId"
                defaultValue={deal?.companyId ?? defaultCompanyId ?? ""}
                className={selectClass}
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-stage">Stage</Label>
              <select
                id="deal-stage"
                name="stage"
                defaultValue={deal?.stage ?? "lead"}
                className={selectClass}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="deal-amount">Amount</Label>
              <Input
                id="deal-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={deal?.amount ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-currency">Currency</Label>
              <select
                id="deal-currency"
                name="currency"
                defaultValue={deal?.currency ?? "USD"}
                className={selectClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deal-close">Expected close</Label>
            <Input
              id="deal-close"
              name="expectedClose"
              type="date"
              defaultValue={deal?.expectedClose ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              name="notes"
              rows={3}
              defaultValue={deal?.notes ?? ""}
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
