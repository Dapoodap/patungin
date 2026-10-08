import { alloc } from "./alloc";

export interface ItemInput {
  name: string;
  amount: number;
  shares: Record<string, number>; // memberId -> porsi bobot
}

export interface AdjustmentInput {
  kind: "tax" | "service" | "tip" | "discount";
  amount: number;
  allocation: "proportional" | "equal";
}

/**
 * Menghitung pembagian struk per item beserta penyesuaian pajak/service/tip/diskon.
 * Total hasil per anggota dijamin tepat sama dengan grand total struk kasir.
 */
export function allocItems(
  items: ItemInput[],
  adjustments: AdjustmentInput[],
  allMemberIds: string[],
): Record<string, number> {
  if (items.length === 0) {
    throw new Error("Daftar item struk tidak boleh kosong");
  }

  const subTotals: Record<string, number> = Object.fromEntries(
    allMemberIds.map((id) => [id, 0]),
  );

  for (const item of items) {
    if (!Number.isInteger(item.amount) || item.amount <= 0) {
      throw new Error(`Harga item "${item.name}" harus integer > 0`);
    }
    const itemShares = alloc(item.amount, item.shares);
    for (const [id, share] of Object.entries(itemShares)) {
      subTotals[id] = (subTotals[id] || 0) + share;
    }
  }

  const netTotals = { ...subTotals };

  for (const adj of adjustments) {
    if (!Number.isInteger(adj.amount) || adj.amount < 0) {
      throw new Error("Nominal penyesuaian harus integer >= 0");
    }
    if (adj.amount === 0) continue;

    let weights: Record<string, number>;
    if (adj.allocation === "proportional") {
      // Dibagi proporsional ke peserta yang memiliki subtotal > 0
      weights = Object.fromEntries(
        Object.entries(subTotals).filter(([, v]) => v > 0),
      );
      if (Object.keys(weights).length === 0) {
        // Fallback jika tidak ada peserta dengan subtotal > 0
        weights = Object.fromEntries(allMemberIds.map((id) => [id, 1]));
      }
    } else {
      // Dibagi rata ke semua peserta
      weights = Object.fromEntries(allMemberIds.map((id) => [id, 1]));
    }

    const adjShares = alloc(adj.amount, weights);
    const isDeduction = adj.kind === "discount";
    for (const [id, share] of Object.entries(adjShares)) {
      netTotals[id] = (netTotals[id] || 0) + (isDeduction ? -share : share);
    }
  }

  return netTotals;
}
