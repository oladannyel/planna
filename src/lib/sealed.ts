import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticated encryption for the one secret this app stores on behalf of a
 * user: the Gmail refresh token (ADR 0002).
 *
 * AES-256-GCM, not AES-CBC or a bare XOR of a hash: GCM authenticates the
 * ciphertext, so a row edited in the database fails to open rather than
 * decrypting to something else. The format is versioned from the start —
 * `v1:<iv>:<tag>:<ciphertext>`, base64url — because the alternative to a
 * version prefix is being unable to rotate the scheme without a migration
 * that can read both.
 */

const VERSION = "v1";
const IV_BYTES = 12; // 96 bits, the size GCM is specified for.
const KEY_BYTES = 32;

export class SealError extends Error {}

/** The key, decoded and checked. Throws rather than encrypting with nothing. */
function key(): Buffer {
  const raw = env.EMAIL_TOKEN_KEY;
  if (!raw) {
    throw new SealError("EMAIL_TOKEN_KEY is not set. Generate one with: openssl rand -base64 32");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new SealError(`EMAIL_TOKEN_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}`);
  }
  return decoded;
}

/** True when sealing is possible at all. The connect flow checks this first. */
export function sealingConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function open(sealed: string): string {
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SealError("Sealed value is not in the expected v1 format");
  }

  const [, ivPart, tagPart, bodyPart] = parts as [string, string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key, or a tampered row. Both are "this value cannot be trusted",
    // and neither should leak which one it was.
    throw new SealError("Sealed value failed authentication");
  }
}
