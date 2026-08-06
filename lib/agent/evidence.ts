// The evidence ledger: nothing about a person is guessed. Tools report
// observations; this module weighs them. Strong, corroborated, primary
// evidence auto-applies to the record; anything weaker becomes a proposal
// a human reviews.

export const EVIDENCE_WEIGHTS = {
  /** The value came from a profile that matches the contact's email. */
  "profile.email-match": { weight: 0.95, primary: true },
  /** LinkedIn profile matching both employer and full name. */
  "linkedin.employer-and-name": { weight: 0.85, primary: true },
  /** Found in an email signature block inside the CRM. */
  "crm.signature-block": { weight: 0.8, primary: true },
  /** Company site / team page naming the person. */
  "web.company-page": { weight: 0.7, primary: true },
  /** A web claim with a citation (news, bio, directory). */
  "web.cited-claim": { weight: 0.4, primary: false },
  /** Inference from a username / handle resembling the name. */
  "handle.name-form": { weight: 0.35, primary: false },
} as const;

export type EvidenceKind = keyof typeof EVIDENCE_WEIGHTS;

export const CONTRADICTION_PENALTY = 0.5;

export interface EvidenceItem {
  kind: EvidenceKind | "contradiction";
  sourceUrl?: string;
  note?: string;
}

export type Band = "verified" | "probable" | "possible";

const BAND_THRESHOLDS: Array<[number, Band]> = [
  [0.85, "verified"],
  [0.6, "probable"],
  [0, "possible"],
];

export interface EvidenceVerdict {
  score: number;
  band: Band;
  /** applied = write to the record now; proposed = wait for human review. */
  status: "applied" | "proposed";
  hasPrimary: boolean;
  contradictions: number;
}

export function scoreEvidence(items: EvidenceItem[]): EvidenceVerdict {
  const support = items.filter(
    (i): i is EvidenceItem & { kind: EvidenceKind } =>
      i.kind !== "contradiction" && i.kind in EVIDENCE_WEIGHTS,
  );
  const contradictions = items.filter((i) => i.kind === "contradiction").length;

  // Noisy-or: independent corroboration compounds without exceeding 1.
  const raw =
    1 -
    support.reduce((acc, i) => acc * (1 - EVIDENCE_WEIGHTS[i.kind].weight), 1);
  const score = raw * (1 - CONTRADICTION_PENALTY) ** contradictions;

  const band = (BAND_THRESHOLDS.find(([min]) => score >= min) ??
    BAND_THRESHOLDS[BAND_THRESHOLDS.length - 1])[1];
  const hasPrimary = support.some((i) => EVIDENCE_WEIGHTS[i.kind].primary);

  const status =
    band === "verified" && hasPrimary && contradictions === 0
      ? "applied"
      : "proposed";

  return { score, band, status, hasPrimary, contradictions };
}

/** Contact columns the agent is allowed to write through facts. */
export const FACT_FIELDS = [
  "role",
  "location",
  "linkedinUrl",
  "email",
  "phone",
] as const;

export type FactField = (typeof FACT_FIELDS)[number];

export function isFactField(field: string): field is FactField {
  return (FACT_FIELDS as readonly string[]).includes(field);
}
