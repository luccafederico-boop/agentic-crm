import { z } from "zod";

export type FormState = { error: string | null };

export const initialFormState: FormState = { error: null };

/** Trimmed string; empty submissions become null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input";
}
