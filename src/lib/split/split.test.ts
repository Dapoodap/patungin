import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { alloc } from "./alloc";
import { computeBalances } from "./balances";
import type { ExpenseInput, SettlementInput } from "./balances";
import { settle } from "./settle";
import type { Transfer } from "./settle";

/* ==========================================================================
 * Helpers
 * ========================================================================== */

function sum(obj: Record<string, number>): number {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

function applyTransfers(
  balances: Record<string, number>,
  transfers: Transfer[],
): Record<string, number> {
  const b = { ...balances };
  for (const t of transfers) {
    b[t.from] += t.amount;
    b[t.to] -= t.amount;
  }
  return b;
}

/* ==========================================================================
 * alloc — Unit tests
 * ========================================================================== */

describe("alloc", () => {
  it("splits equally among 3 people with weight 1", () => {
    const result = alloc(100, { a: 1, b: 1, c: 1 });
    expect(sum(result)).toBe(100);
    // 100 / 3 = 33.33.. → two get 33, one gets 34
    expect(Object.values(result).sort()).toEqual([33, 33, 34]);
  });

  it("gives everything to single participant", () => {
    const result = alloc(50000, { solo: 1 });
    expect(result).toEqual({ solo: 50000 });
  });

  it("handles weight 2 (double portion)", () => {
    // a=1, b=2 → total weight 3, amount 300
    // a gets 100, b gets 200
    const result = alloc(300, { a: 1, b: 2 });
    expect(result).toEqual({ a: 100, b: 200 });
  });

  it("handles weight 0.5 (half portion)", () => {
    // a=1, b=0.5 → total weight 150, amount 150
    // a = 150*100/150 = 100, b = 150*50/150 = 50
    const result = alloc(150, { a: 1, b: 0.5 });
    expect(result).toEqual({ a: 100, b: 50 });
  });

  it("handles mixed weights with remainder", () => {
    // a=1, b=2, c=0.5 → weights x100: 100, 200, 50 → total 350
    // amount = 1000
    // a: floor(1000*100/350) = floor(285.71) = 285, rem = 1000*100 % 350 = 100000%350 = 250
    // b: floor(1000*200/350) = floor(571.43) = 571, rem = 200000%350 = 200000 - 571*350 = 200000-199850 = 150
    // c: floor(1000*50/350) = floor(142.86) = 142, rem = 50000%350 = 50000 - 142*350 = 50000-49700 = 300
    // rest = 1000 - 285 - 571 - 142 = 2
    // sort by rem desc: c(300), a(250), b(150)
    // c gets +1 = 143, a gets +1 = 286, b stays 571
    // total = 143 + 286 + 571 = 1000 ✓
    const result = alloc(1000, { a: 1, b: 2, c: 0.5 });
    expect(sum(result)).toBe(1000);
    expect(result).toEqual({ a: 286, b: 571, c: 143 });
  });

  it("throws on zero amount", () => {
    expect(() => alloc(0, { a: 1 })).toThrow("amount harus integer > 0");
  });

  it("throws on negative amount", () => {
    expect(() => alloc(-100, { a: 1 })).toThrow("amount harus integer > 0");
  });

  it("throws on non-integer amount", () => {
    expect(() => alloc(100.5, { a: 1 })).toThrow("amount harus integer > 0");
  });

  it("throws on empty participants", () => {
    expect(() => alloc(100, {})).toThrow("peserta kosong");
  });

  it("ignores zero-weight participants", () => {
    const result = alloc(100, { a: 1, b: 0, c: 1 });
    expect(result).toEqual({ a: 50, c: 50 });
    expect(result.b).toBeUndefined();
  });

  it("deterministic tie-breaking by ID (ascending)", () => {
    // 100 / 3 = 33 rem 1, remainder is same for all
    // IDs sorted: a, b, c → a gets the extra 1
    const r1 = alloc(100, { c: 1, a: 1, b: 1 });
    expect(r1.a).toBe(34);
    expect(r1.b).toBe(33);
    expect(r1.c).toBe(33);

    // Same result regardless of input order
    const r2 = alloc(100, { b: 1, c: 1, a: 1 });
    expect(r2).toEqual(r1);
  });
});

/* ==========================================================================
 * computeBalances — Unit tests
 * ========================================================================== */

describe("computeBalances", () => {
  it("returns zero balances with no expenses", () => {
    const bal = computeBalances(["a", "b"], [], []);
    expect(bal).toEqual({ a: 0, b: 0 });
  });

  it("computes simple 2-person split", () => {
    const shares = alloc(100, { a: 1, b: 1 }); // a=50, b=50
    const expenses: ExpenseInput[] = [
      { payerId: "a", amount: 100, shares },
    ];
    const bal = computeBalances(["a", "b"], expenses, []);
    // a paid 100, owes 50 → +50
    // b paid 0, owes 50 → -50
    expect(bal).toEqual({ a: 50, b: -50 });
    expect(sum(bal)).toBe(0);
  });

  it("accounts for confirmed settlements", () => {
    const shares = alloc(100, { a: 1, b: 1 });
    const expenses: ExpenseInput[] = [
      { payerId: "a", amount: 100, shares },
    ];
    const settlements: SettlementInput[] = [
      { fromId: "b", toId: "a", amount: 50 },
    ];
    const bal = computeBalances(["a", "b"], expenses, settlements);
    expect(bal).toEqual({ a: 0, b: 0 });
  });

  it("sum of balances is always 0", () => {
    const expenses: ExpenseInput[] = [
      { payerId: "a", amount: 300, shares: alloc(300, { a: 1, b: 1, c: 1 }) },
      { payerId: "b", amount: 150, shares: alloc(150, { a: 1, c: 1 }) },
    ];
    const bal = computeBalances(["a", "b", "c"], expenses, []);
    expect(sum(bal)).toBe(0);
  });
});

/* ==========================================================================
 * settle — Unit tests
 * ========================================================================== */

describe("settle", () => {
  it("returns no transfers when all balanced", () => {
    expect(settle({ a: 0, b: 0, c: 0 })).toEqual([]);
  });

  it("settles 2-person case", () => {
    const transfers = settle({ a: 50, b: -50 });
    expect(transfers).toEqual([{ from: "b", to: "a", amount: 50 }]);
  });

  it("settles 3-person case", () => {
    const transfers = settle({ a: 100, b: -60, c: -40 });
    expect(transfers.length).toBeLessThanOrEqual(2); // at most n-1
    const after = applyTransfers({ a: 100, b: -60, c: -40 }, transfers);
    expect(after.a).toBe(0);
    expect(after.b).toBe(0);
    expect(after.c).toBe(0);
  });

  it("settles 5-person case", () => {
    const bal = { a: 200, b: -100, c: -50, d: -30, e: -20 };
    const transfers = settle(bal);
    expect(transfers.length).toBeLessThanOrEqual(4); // at most n-1
    const after = applyTransfers(bal, transfers);
    for (const v of Object.values(after)) {
      expect(v).toBe(0);
    }
  });
});

/* ==========================================================================
 * Golden test — Trip Jogja (18 expenses from section 5.1)
 * ========================================================================== */

describe("Golden test — Trip Jogja", () => {
  // Members sorted alphabetically (daffa, kiki, rakya) — same as ID tiebreak
  const DAFFA = "daffa";
  const KIKI = "kiki";
  const RAKYA = "rakya";
  const ALL = { [DAFFA]: 1, [KIKI]: 1, [RAKYA]: 1 };

  const goldenExpenses: Array<{
    item: string;
    amount: number;
    payer: string;
    participants: Record<string, number>;
  }> = [
    { item: "Grab ke Jombor", amount: 23500, payer: DAFFA, participants: ALL },
    { item: "Grab ke sewa motor", amount: 131000, payer: DAFFA, participants: ALL },
    { item: "Ice lychee tea", amount: 35000, payer: DAFFA, participants: { [KIKI]: 1 } },
    { item: "Ice choco", amount: 45000, payer: DAFFA, participants: { [RAKYA]: 1 } },
    { item: "Sewa motor", amount: 560000, payer: RAKYA, participants: ALL },
    { item: "KFC", amount: 48500, payer: KIKI, participants: ALL },
    { item: "Whiterock", amount: 36000, payer: KIKI, participants: ALL },
    { item: "Bensin motor", amount: 25000, payer: RAKYA, participants: { [DAFFA]: 1 } },
    { item: "Sate day 1", amount: 35000, payer: KIKI, participants: ALL },
    { item: "Bahan pokok day 1", amount: 45000, payer: KIKI, participants: ALL },
    { item: "Indomaret day 2", amount: 181800, payer: DAFFA, participants: ALL },
    { item: "Indomaret day 3", amount: 63000, payer: DAFFA, participants: ALL },
    { item: "Indomaret day 1", amount: 116400, payer: DAFFA, participants: ALL },
    { item: "Sate day 2", amount: 50000, payer: RAKYA, participants: ALL },
    { item: "Oleh-oleh", amount: 175000, payer: DAFFA, participants: ALL },
    { item: "Sendal", amount: 20000, payer: KIKI, participants: { [RAKYA]: 1 } },
    { item: "Grepe", amount: 112000, payer: DAFFA, participants: ALL },
    { item: "Grepe", amount: 21000, payer: KIKI, participants: { [RAKYA]: 1 } },
  ];

  // Build expenses with allocation
  const expenses: ExpenseInput[] = goldenExpenses.map((e) => ({
    payerId: e.payer,
    amount: e.amount,
    shares: alloc(e.amount, e.participants),
  }));

  const memberIds = [DAFFA, KIKI, RAKYA];
  const balances = computeBalances(memberIds, expenses, []);
  const transfers = settle(balances);

  it("total expense is 1,723,200", () => {
    const total = goldenExpenses.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(1723200);
  });

  it("sum of all shares per expense equals expense amount", () => {
    for (const e of expenses) {
      expect(sum(e.shares)).toBe(e.amount);
    }
  });

  it("sum of all balances is 0", () => {
    expect(sum(balances)).toBe(0);
  });

  it("daffa balance is +331,963", () => {
    expect(balances[DAFFA]).toBe(331963);
  });

  it("kiki balance is -355,234", () => {
    expect(balances[KIKI]).toBe(-355234);
  });

  it("rakya balance is +23,271", () => {
    expect(balances[RAKYA]).toBe(23271);
  });

  it("paid amounts match expected", () => {
    // daffa paid: items 1,2,3,4,11,12,13,15,17
    const daffaPaid = [23500, 131000, 35000, 45000, 181800, 63000, 116400, 175000, 112000].reduce((a, b) => a + b, 0);
    expect(daffaPaid).toBe(882700);

    // kiki paid: items 6,7,9,10,16,18
    const kikiPaid = [48500, 36000, 35000, 45000, 20000, 21000].reduce((a, b) => a + b, 0);
    expect(kikiPaid).toBe(205500);

    // rakya paid: items 5,8,14
    const rakyaPaid = [560000, 25000, 50000].reduce((a, b) => a + b, 0);
    expect(rakyaPaid).toBe(635000);

    expect(daffaPaid + kikiPaid + rakyaPaid).toBe(1723200);
  });

  it("tanggungan (shares owed) match expected", () => {
    // Sum up all shares assigned to each member
    const tanggungan: Record<string, number> = { [DAFFA]: 0, [KIKI]: 0, [RAKYA]: 0 };
    for (const e of expenses) {
      for (const [id, share] of Object.entries(e.shares)) {
        tanggungan[id] += share;
      }
    }
    expect(tanggungan[DAFFA]).toBe(550737);
    expect(tanggungan[KIKI]).toBe(560734);
    expect(tanggungan[RAKYA]).toBe(611729);
    expect(tanggungan[DAFFA] + tanggungan[KIKI] + tanggungan[RAKYA]).toBe(1723200);
  });

  it("settle produces kiki→daffa 331,963 and kiki→rakya 23,271", () => {
    expect(transfers).toHaveLength(2);

    const sorted = [...transfers].sort((a, b) => b.amount - a.amount);
    expect(sorted[0]).toEqual({ from: KIKI, to: DAFFA, amount: 331963 });
    expect(sorted[1]).toEqual({ from: KIKI, to: RAKYA, amount: 23271 });
  });

  it("applying transfers zeroes all balances", () => {
    const after = applyTransfers(balances, transfers);
    expect(after[DAFFA]).toBe(0);
    expect(after[KIKI]).toBe(0);
    expect(after[RAKYA]).toBe(0);
  });
});

/* ==========================================================================
 * Property-based tests (fast-check)
 * ========================================================================== */

describe("Property-based tests", () => {
  // Arbitrary: generates 2-10 member IDs and a valid amount
  const membersArb = fc
    .uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 2, maxLength: 10 })
    .filter((arr) => arr.length >= 2);

  const amountArb = fc.integer({ min: 1, max: 10_000_000 });

  // Generate weights for a subset of members (at least 1)
  function weightsArb(memberIds: string[]) {
    return fc
      .tuple(
        // At least 1 participant
        fc.shuffledSubarray(memberIds, { minLength: 1 }),
        fc.array(
          fc.constantFrom(0.5, 1, 1.5, 2),
          { minLength: 1, maxLength: memberIds.length },
        ),
      )
      .map(([participants, wArr]) => {
        const w: Record<string, number> = {};
        for (let i = 0; i < participants.length; i++) {
          w[participants[i]] = wArr[i % wArr.length];
        }
        return w;
      });
  }

  it("alloc: sum(shares) === amount for any valid input", () => {
    fc.assert(
      fc.property(amountArb, membersArb, (amount, members) => {
        const w: Record<string, number> = {};
        for (const m of members) w[m] = 1;
        const shares = alloc(amount, w);
        expect(sum(shares)).toBe(amount);
      }),
      { numRuns: 500 },
    );
  });

  it("alloc: all shares are non-negative integers", () => {
    fc.assert(
      fc.property(amountArb, membersArb, (amount, members) => {
        const w: Record<string, number> = {};
        for (const m of members) w[m] = 1;
        const shares = alloc(amount, w);
        for (const v of Object.values(shares)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(v)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("alloc: with arbitrary weights, sum still equals amount", () => {
    fc.assert(
      fc.property(
        amountArb,
        membersArb.chain((m) => fc.tuple(fc.constant(m), weightsArb(m))),
        (amount, [, weights]) => {
          const shares = alloc(amount, weights);
          expect(sum(shares)).toBe(amount);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("computeBalances: sum is always 0", () => {
    fc.assert(
      fc.property(
        membersArb,
        fc.array(amountArb, { minLength: 1, maxLength: 20 }),
        (members, amounts) => {
          const expenses: ExpenseInput[] = amounts.map((amt, i) => {
            const payer = members[i % members.length];
            const shares = alloc(amt, Object.fromEntries(members.map((m) => [m, 1])));
            return { payerId: payer, amount: amt, shares };
          });
          const bal = computeBalances(members, expenses, []);
          expect(sum(bal)).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("settle: produces at most n-1 transfers", () => {
    fc.assert(
      fc.property(
        membersArb,
        fc.array(amountArb, { minLength: 1, maxLength: 20 }),
        (members, amounts) => {
          const expenses: ExpenseInput[] = amounts.map((amt, i) => {
            const payer = members[i % members.length];
            const shares = alloc(amt, Object.fromEntries(members.map((m) => [m, 1])));
            return { payerId: payer, amount: amt, shares };
          });
          const bal = computeBalances(members, expenses, []);
          const transfers = settle(bal);
          expect(transfers.length).toBeLessThanOrEqual(members.length - 1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("settle: applying transfers zeroes all balances", () => {
    fc.assert(
      fc.property(
        membersArb,
        fc.array(amountArb, { minLength: 1, maxLength: 20 }),
        (members, amounts) => {
          const expenses: ExpenseInput[] = amounts.map((amt, i) => {
            const payer = members[i % members.length];
            const shares = alloc(amt, Object.fromEntries(members.map((m) => [m, 1])));
            return { payerId: payer, amount: amt, shares };
          });
          const bal = computeBalances(members, expenses, []);
          const transfers = settle(bal);
          const after = applyTransfers(bal, transfers);
          for (const v of Object.values(after)) {
            expect(v).toBe(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
