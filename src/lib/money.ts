/**
 * money.ts — Format rupiah integer to display string.
 * Uang selalu integer rupiah, tidak ada floating-point.
 */
export function formatRupiah(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("id-ID");
  if (amount < 0) {
    return `-Rp ${formatted}`;
  }
  return `Rp ${formatted}`;
}
