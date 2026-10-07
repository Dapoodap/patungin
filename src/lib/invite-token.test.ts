import { describe, it, expect } from "vitest";
import { newInviteToken, hashToken } from "./invite-token";
import { checkRateLimit } from "./ratelimit";

describe("Invite Token Crypto & Verification", () => {
  it("generates 32-byte base64url token with valid sha256 hash", () => {
    const { token, tokenHash } = newInviteToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    // 32 bytes base64url is 43 characters long
    expect(token.length).toBeGreaterThanOrEqual(42);

    expect(tokenHash).toBeDefined();
    // sha256 hex is exactly 64 characters
    expect(tokenHash).toHaveLength(64);

    // Verifying same hash
    expect(hashToken(token)).toBe(tokenHash);
  });

  it("produces distinct tokens on subsequent invocations", () => {
    const t1 = newInviteToken();
    const t2 = newInviteToken();

    expect(t1.token).not.toBe(t2.token);
    expect(t1.tokenHash).not.toBe(t2.tokenHash);
  });
});

describe("Rate Limiting Fail-Open Behavior", () => {
  it("fails open gracefully when limiter is null (e.g. offline Redis in test)", async () => {
    const res = await checkRateLimit(null, "test-user-id");
    expect(res.success).toBe(true);
  });
});
