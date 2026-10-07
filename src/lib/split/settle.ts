// settle.ts — Greedy minimum transfer algorithm
// Pure TypeScript, no framework or database imports.

export interface Transfer {
  from: string;
  to: string;
  amount: number; // integer rupiah
}

/**
 * Greedy settlement: largest debtor pays largest creditor.
 * Produces at most n-1 transfers.
 * Input: balances where positive = creditor, negative = debtor.
 */
export function settle(balances: Record<string, number>): Transfer[] {
  const b = { ...balances };
  const ids = Object.keys(b).sort(); // deterministic order
  const out: Transfer[] = [];

  for (;;) {
    let d = ids[0];
    let c = ids[0];
    for (const id of ids) {
      if (b[id] < b[d]) d = id;
      if (b[id] > b[c]) c = id;
    }
    const amt = Math.min(-b[d], b[c]);
    if (amt <= 0) break;
    out.push({ from: d, to: c, amount: amt });
    b[d] += amt;
    b[c] -= amt;
  }

  return out;
}
