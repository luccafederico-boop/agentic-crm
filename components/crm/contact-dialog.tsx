"use client";

import { useActionState, useState } from "react";
import { saveContact } from "@/actions/contacts";
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
import type { Contact } from "@/lib/db/schema";
import { type FormState, initialFormState } from "@/lib/forms";

export type CompanyOption = { id: string; name: string };

export function ContactDialog({
  contact,
  companies,
  defaultCompanyId,
  trigger,
}: {
  contact?: Contact;
  companies: CompanyOption[];
  defaultCompanyId?: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await saveContact(prev, formData);
      if (!result.error) setOpen(false);
      return result;
    },
    initialFormState,
  );
  const companyId = contact?.companyId ?? defaultCompanyId ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {contact && <input type="hidden" name="id" value={contact.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              name="name"
              defaultValue={contact?.name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                defaultValue={contact?.email ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                name="phone"
                defaultValue={contact?.phone ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-role">Role</Label>
              <Input
                id="contact-role"
                name="role"
                placeholder="Head of Sales"
                defaultValue={contact?.role ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-company">Company</Label>
              <select
                id="contact-company"
                name="companyId"
                defaultValue={companyId}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
              <Input
                id="contact-linkedin"
                name="linkedinUrl"
                defaultValue={contact?.linkedinUrl ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-location">Location</Label>
              <Input
                id="contact-location"
                name="location"
                defaultValue={contact?.location ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              name="notes"
              rows={3}
              defaultValue={contact?.notes ?? ""}
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
