import { formatRupiah } from "../money";

export interface RecapMember {
  id: string;
  name: string;
}

export interface RecapTransfer {
  fromId: string;
  toId: string;
  amount: number;
}

export interface FormatRecapInput {
  groupName: string;
  totalExpenses: number;
  members: RecapMember[];
  balances: Record<string, number>;
  transfers: RecapTransfer[];
}

/**
 * Format teks ringkasan rekap grup siap kirim/tempel untuk WhatsApp.
 * Fungsi murni, deterministik, aman terhadap nilai 0 / kosong / anggota tanpa akun.
 */
export function formatRecap(input: FormatRecapInput): string {
  const { groupName, totalExpenses, members, balances, transfers } = input;

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.id, m.name || "Tanpa Nama");
  }

  const lines: string[] = [];

  lines.push(`💰 *REKAP PATUNGAN: ${groupName.trim()}*`);
  lines.push(`Total Pengeluaran: ${formatRupiah(Math.max(0, totalExpenses || 0))}`);
  lines.push("");

  // Saldo per anggota - urutkan deterministik berdasarkan nama lalu id
  lines.push("📊 *Status Saldo:*");
  const sortedMembers = [...members].sort((a, b) => {
    const cmp = (a.name || "").localeCompare(b.name || "");
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  if (sortedMembers.length === 0) {
    lines.push("- Belum ada anggota.");
  } else {
    for (const m of sortedMembers) {
      const bal = balances[m.id] ?? 0;
      let badge = "⚪";
      let statusText = "Lunas";

      if (bal > 0) {
        badge = "🟢";
        statusText = `Menerima ${formatRupiah(bal)}`;
      } else if (bal < 0) {
        badge = "🔴";
        statusText = `Membayar ${formatRupiah(Math.abs(bal))}`;
      } else {
        badge = "⚪";
        statusText = "Rp 0 (Pas)";
      }

      lines.push(`${badge} *${m.name}*: ${statusText}`);
    }
  }

  lines.push("");

  // Daftar transfer penyelesaian
  lines.push("🤝 *Daftar Transfer Pelunasan:*");
  const validTransfers = (transfers || []).filter((t) => t.amount > 0);

  if (validTransfers.length === 0) {
    lines.push("✅ Semua sudah lunas! Tidak ada transfer yang diperlukan.");
  } else {
    // Urutkan transfer deterministik (from, to)
    const sortedTransfers = [...validTransfers].sort((a, b) => {
      const fromA = memberMap.get(a.fromId) || a.fromId;
      const fromB = memberMap.get(b.fromId) || b.fromId;
      const cmpFrom = fromA.localeCompare(fromB);
      if (cmpFrom !== 0) return cmpFrom;
      const toA = memberMap.get(a.toId) || a.toId;
      const toB = memberMap.get(b.toId) || b.toId;
      return toA.localeCompare(toB);
    });

    sortedTransfers.forEach((t, idx) => {
      const fromName = memberMap.get(t.fromId) || "Anggota";
      const toName = memberMap.get(t.toId) || "Anggota";
      lines.push(`${idx + 1}. *${fromName}* ➔ *${toName}*: ${formatRupiah(t.amount)}`);
    });
  }

  lines.push("");
  lines.push("— Dibuat dengan Patungan");

  return lines.join("\n");
}
