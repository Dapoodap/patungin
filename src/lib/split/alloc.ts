// alloc.ts — Largest remainder allocation for splitting expenses
// Pure TypeScript, no framework or database imports.

export type Weights = Record<string, number>; // memberId -> weight (> 0)

/**
 * Allocate `amount` (integer rupiah) according to weights.
 * Uses largest-remainder method so sum(result) === amount always.
 * Ties broken deterministically by member ID (lexicographic ascending).
 */
export function alloc(
  amount: number,
  weights: Weights,
): Record<string, number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount harus integer > 0");
  }

  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (entries.length === 0) {
    throw new Error("peserta kosong");
  }

  // Convert weights to integers by multiplying by 100, to avoid floating-point errors
  // e.g., 0.5 -> 50, 1 -> 100, 2 -> 200
  const w = entries.map(([id, v]) => [id, Math.round(v * 100)] as const);
  const total = w.reduce((s, [, v]) => s + v, 0);

  const rows = w.map(([id, v]) => {
    const num = amount * v;
    return { id, base: Math.floor(num / total), rem: num % total };
  });

  let rest = amount - rows.reduce((s, r) => s + r.base, 0);

  // Distribute remainder: largest remainder first; ties broken by id (ascending)
  rows.sort((a, b) => b.rem - a.rem || a.id.localeCompare(b.id));
  for (const r of rows) {
    if (rest > 0) {
      r.base += 1;
      rest -= 1;
    }
  }

  return Object.fromEntries(rows.map((r) => [r.id, r.base]));
}
