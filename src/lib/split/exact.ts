/**
 * Memvalidasi pembagian nominal rupiah pasti per peserta.
 * Jumlah nominal seluruh peserta harus sama persis dengan total amount.
 */
export function allocExact(
  amount: number,
  exacts: Record<string, number>,
): Record<string, number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount harus integer > 0");
  }

  for (const [id, val] of Object.entries(exacts)) {
    if (!Number.isInteger(val) || val < 0) {
      throw new Error(`Nominal untuk ${id} harus integer >= 0`);
    }
  }

  const totalExact = Object.values(exacts).reduce((s, val) => s + val, 0);
  if (totalExact !== amount) {
    throw new Error(
      `Total rincian (Rp${totalExact}) harus sama dengan nominal pengeluaran (Rp${amount})`,
    );
  }

  return { ...exacts };
}
