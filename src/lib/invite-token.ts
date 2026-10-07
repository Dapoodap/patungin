import { randomBytes, createHash } from "node:crypto";

/**
 * Generate a cryptographically secure 32-byte URL-safe invite token
 * and its SHA-256 hash. The raw token is returned once to show to the owner,
 * and only the hash is stored in the database.
 */
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/**
 * Hash an existing token to lookup in the database.
 */
export const hashToken = (t: string) =>
  createHash("sha256").update(t).digest("hex");
