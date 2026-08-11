// AES-256-GCM for secrets at rest (Google refresh tokens). Wire format:
// base64(iv | ciphertext | authTag) — GCM authenticates, so tampering fails
// loudly on decrypt instead of yielding garbage.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (hex?.length !== 64) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes hex (64 chars)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, enc, cipher.getAuthTag()]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const enc = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}
