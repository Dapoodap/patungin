// balances.ts — Compute per-member balances from expenses and settlements
// Pure TypeScript, no framework or database imports.

export interface ExpenseInput {
  payerId: string;
  amount: number; // integer rupiah
  shares: Record<string, number>; // memberId -> share_amount (integer rupiah)
}

export interface SettlementInput {
  fromId: string;
  toId: string;
  amount: number; // integer rupiah, only confirmed settlements
}

/**
 * Compute balance for each member.
 * Positive balance = receives money (creditor).
 * Negative balance = owes money (debtor).
 * Invariant: sum of all balances === 0.
 */
export function computeBalances(
  memberIds: string[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[],
): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0]),
  );

  for (const e of expenses) {
    bal[e.payerId] += e.amount; // payer gets credit
    for (const [id, share] of Object.entries(e.shares)) {
      bal[id] -= share; // participant gets debited
    }
  }

  for (const s of settlements) {
    bal[s.fromId] += s.amount; // sender approaches 0 from below
    bal[s.toId] -= s.amount; // receiver approaches 0 from above
  }

  return bal;
}
