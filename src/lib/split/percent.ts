import { alloc } from "./alloc";

/**
 * Membagi amount berdasarkan persentase tiap peserta.
 * Total persentase harus tepat 100,00% (toleransi presisi floating-point 0.001).
 */
export function allocPercent(
  amount: number,
  percentages: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(percentages).filter(([, p]) => p > 0);
  if (entries.length === 0) throw new Error("Peserta kosong");

  const totalPercent = entries.reduce((s, [, p]) => s + p, 0);
  if (Math.abs(totalPercent - 100) > 0.001) {
    throw new Error(
      `Total persentase harus tepat 100,00% (saat ini ${totalPercent.toFixed(2)}%)`,
    );
  }

  return alloc(amount, percentages);
}
