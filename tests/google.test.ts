import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { extractEmails } from "@/lib/google/sync";

// APP_ENCRYPTION_KEY comes from .env locally; CI sets a throwaway key.
const hasKey = Boolean(process.env.APP_ENCRYPTION_KEY);
const cryptoSuite = hasKey ? describe : describe.skip;

cryptoSuite("secret encryption", () => {
  it("round-trips a refresh token", () => {
    const token = "1//0gABCdefGhIJKlmnOPqrstUVwxYZ-1234567890";
    const enc = encryptSecret(token);
    expect(enc).not.toContain(token);
    expect(decryptSecret(enc)).toBe(token);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("fails loudly on tampered ciphertext", () => {
    const enc = Buffer.from(encryptSecret("secret"), "base64");
    enc[enc.length - 1] ^= 0xff; // flip a bit in the auth tag
    expect(() => decryptSecret(enc.toString("base64"))).toThrow();
  });
});

describe("extractEmails", () => {
  it("parses display-name and bare address forms", () => {
    expect(
      extractEmails("Ada Lovelace <Ada@Example.com>, bob@example.com"),
    ).toEqual(["ada@example.com", "bob@example.com"]);
  });

  it("returns empty for missing or address-free headers", () => {
    expect(extractEmails(undefined)).toEqual([]);
    expect(extractEmails("Undisclosed recipients")).toEqual([]);
  });
});
