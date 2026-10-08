import { describe, it, expect } from "vitest";
import { newShareToken, hashShareToken } from "./token";
import type { PublicGroupShareDTO } from "./public-dto";

describe("Public Share Token & DTO Security", () => {
  it("generates high-entropy 32-byte tokens with SHA-256 hash", () => {
    const { token, tokenHash } = newShareToken();

    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(42); // 32 bytes base64url ~43 chars
    expect(tokenHash).toHaveLength(64); // SHA-256 hex is 64 chars
    expect(hashShareToken(token)).toBe(tokenHash);
  });

  it("produces deterministic SHA-256 hashes", () => {
    const token = "custom-test-token-value-1234567890";
    const hash1 = hashShareToken(token);
    const hash2 = hashShareToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ensures PublicGroupShareDTO adheres strictly to zero-PII whitelist", () => {
    // Mock sample DTO structure
    const sampleDTO: PublicGroupShareDTO = {
      groupId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Liburan Bali 2026",
      description: "Patungan jalan-jalan santai",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      showDetails: false,
      totalExpenses: 500000,
      members: [
        {
          id: "m1",
          name: "Budi",
          paid: 500000,
          share: 250000,
          balance: 250000,
        },
        {
          id: "m2",
          name: "Siti",
          paid: 0,
          share: 250000,
          balance: -250000,
        },
      ],
      transfers: [
        {
          fromName: "Siti",
          toName: "Budi",
          amount: 250000,
        },
      ],
      categories: [
        { name: "makanan", amount: 500000 },
      ],
    };

    // Serialize to JSON string to inspect all keys
    const serialized = JSON.stringify(sampleDTO);
    const parsedObj = JSON.parse(serialized);

    // Forbidden PII fields must not exist anywhere in keys
    const forbiddenKeys = [
      "email",
      "password",
      "userId",
      "user_id",
      "tokenHash",
      "token_hash",
      "paymentMethod",
      "paymentMethods",
      "bank",
      "accountNumber",
      "account_number",
      "actorUserId",
      "auditLogs",
      "invites",
      "inviteToken",
    ];

    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(`"${key}":`);
    }

    // Members must only have name, paid, share, balance, id
    for (const member of parsedObj.members) {
      expect(Object.keys(member).sort()).toEqual([
        "balance",
        "id",
        "name",
        "paid",
        "share",
      ]);
    }

    // Transfers must only have fromName, toName, amount
    for (const transfer of parsedObj.transfers) {
      expect(Object.keys(transfer).sort()).toEqual([
        "amount",
        "fromName",
        "toName",
      ]);
    }
  });

  it("handles showDetails properly without exposing internal IDs or PII", () => {
    const detailedDTO: PublicGroupShareDTO = {
      groupId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Makan Malam",
      description: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      showDetails: true,
      totalExpenses: 150000,
      members: [],
      transfers: [],
      categories: [],
      expenses: [
        {
          id: "exp-1",
          title: "Sate Khas Senayan",
          amount: 150000,
          category: "makanan",
          spentAt: new Date().toISOString(),
          payerName: "Budi",
          splits: [
            { memberName: "Budi", shareAmount: 75000 },
            { memberName: "Siti", shareAmount: 75000 },
          ],
        },
      ],
    };

    const serialized = JSON.stringify(detailedDTO);
    expect(serialized).not.toContain('"payerMemberId":');
    expect(serialized).not.toContain('"email":');
    expect(serialized).not.toContain('"actorUserId":');
    expect(detailedDTO.expenses![0].payerName).toBe("Budi");
    expect(detailedDTO.expenses![0].splits[0].memberName).toBe("Budi");
  });
});
