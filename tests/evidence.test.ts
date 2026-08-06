import { describe, expect, it } from "vitest";
import {
  EVIDENCE_WEIGHTS,
  type EvidenceItem,
  isFactField,
  scoreEvidence,
} from "@/lib/agent/evidence";

describe("scoreEvidence", () => {
  it("returns zero score and proposes when there is no evidence", () => {
    const v = scoreEvidence([]);
    expect(v.score).toBe(0);
    expect(v.band).toBe("possible");
    expect(v.status).toBe("proposed");
  });

  it("applies a single strong primary evidence (email match)", () => {
    const v = scoreEvidence([{ kind: "profile.email-match" }]);
    expect(v.score).toBeCloseTo(0.95);
    expect(v.band).toBe("verified");
    expect(v.hasPrimary).toBe(true);
    expect(v.status).toBe("applied");
  });

  it("proposes a single weak non-primary evidence (cited web claim)", () => {
    const v = scoreEvidence([{ kind: "web.cited-claim" }]);
    expect(v.score).toBeCloseTo(0.4);
    expect(v.band).toBe("possible");
    expect(v.status).toBe("proposed");
  });

  it("compounds corroborating evidence with noisy-or", () => {
    const v = scoreEvidence([
      { kind: "web.cited-claim" },
      { kind: "handle.name-form" },
    ]);
    // 1 - (1-0.4)(1-0.35) = 0.61
    expect(v.score).toBeCloseTo(0.61);
    expect(v.band).toBe("probable");
    // probable + no primary → still proposed
    expect(v.status).toBe("proposed");
  });

  it("never exceeds a score of 1 regardless of evidence count", () => {
    const all = Object.keys(EVIDENCE_WEIGHTS).map((kind) => ({
      kind,
    })) as EvidenceItem[];
    const v = scoreEvidence(all);
    expect(v.score).toBeLessThanOrEqual(1);
    expect(v.band).toBe("verified");
  });

  it("proposes verified-band facts that lack primary evidence", () => {
    // Three weak corroborations can reach verified band by score alone...
    const v = scoreEvidence([
      { kind: "web.cited-claim" },
      { kind: "web.cited-claim" },
      { kind: "web.cited-claim" },
      { kind: "handle.name-form" },
      { kind: "handle.name-form" },
    ]);
    expect(v.hasPrimary).toBe(false);
    // ...but must never auto-apply without a primary source.
    expect(v.status).toBe("proposed");
  });

  it("halves the score per contradiction and blocks auto-apply", () => {
    const clean = scoreEvidence([{ kind: "profile.email-match" }]);
    const contradicted = scoreEvidence([
      { kind: "profile.email-match" },
      { kind: "contradiction", note: "another profile says otherwise" },
    ]);
    expect(contradicted.score).toBeCloseTo(clean.score * 0.5);
    expect(contradicted.status).toBe("proposed");
    expect(contradicted.contradictions).toBe(1);
  });

  it("ignores unknown evidence kinds instead of throwing", () => {
    const v = scoreEvidence([
      { kind: "made-up-kind" } as unknown as EvidenceItem,
      { kind: "profile.email-match" },
    ]);
    expect(v.score).toBeCloseTo(0.95);
  });
});

describe("isFactField", () => {
  it("accepts only whitelisted contact fields", () => {
    expect(isFactField("role")).toBe(true);
    expect(isFactField("location")).toBe(true);
    expect(isFactField("name")).toBe(false);
    expect(isFactField("notes")).toBe(false);
    expect(isFactField("id")).toBe(false);
  });
});
