"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";
import Link from "next/link";
import {
  createSettlement,
  confirmSettlement,
  rejectSettlement,
  recordDirectSettlement,
} from "@/app/actions/settlement";

interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  status: "paid" | "confirmed" | "rejected";
  note: string | null;
  paidAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

interface PaymentMethod {
  id: string;
  memberId: string;
  type: string;
  label: string;
  value: string;
}

const paymentTypeEmoji: Record<string, string> = {
  gopay: "💚",
  shopeepay: "🧡",
  dana: "💙",
  ovo: "💜",
  bank: "🏦",
  qris: "📱",
  other: "💳",
};

export function SettleClientView({
  groupId,
  currentMember,
  members,
  balances,
  suggestedTransfers,
  allSettlements,
  paymentMethods,
}: {
  groupId: string;
  currentMember: Member;
  members: Member[];
  balances: Record<string, number>;
  suggestedTransfers: Transfer[];
  allSettlements: Settlement[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Owner direct settlement modal state
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directFrom, setDirectFrom] = useState(members[0]?.id || "");
  const [directTo, setDirectTo] = useState(members[1]?.id || members[0]?.id || "");
  const [directAmount, setDirectAmount] = useState("");
  const [directNote, setDirectNote] = useState("");
  const [directSubmitting, setDirectSubmitting] = useState(false);

  const memberNameMap = Object.fromEntries(
    members.map((m) => [m.id, m.displayName]),
  );

  // Separate settlements by status
  const pendingSettlements = allSettlements.filter(
    (s) => s.status === "paid",
  );
  const confirmedSettlements = allSettlements.filter(
    (s) => s.status === "confirmed",
  );
  const rejectedSettlements = allSettlements.filter(
    (s) => s.status === "rejected",
  );

  const allLunas = suggestedTransfers.length === 0;

  // Get payment methods for a given member
  const getPaymentMethods = (memberId: string) =>
    paymentMethods.filter((pm) => pm.memberId === memberId);

  const handleMarkPaid = async (transfer: Transfer) => {
    setLoading(`mark-${transfer.from}-${transfer.to}`);
    setStatusMsg(null);

    const res = await createSettlement({
      groupId,
      fromMemberId: transfer.from,
      toMemberId: transfer.to,
      amount: transfer.amount,
    });

    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: `Transfer ${formatRupiah(transfer.amount)} telah ditandai. Menunggu konfirmasi dari penerima.`,
      });
      router.refresh();
    }
    setLoading(null);
  };

  const handleConfirm = async (settlementId: string) => {
    if (!confirm("Konfirmasi bahwa uang sudah diterima?")) return;
    setLoading(`confirm-${settlementId}`);
    setStatusMsg(null);

    const res = await confirmSettlement(groupId, settlementId);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: "Pelunasan dikonfirmasi. Saldo telah diperbarui.",
      });
      router.refresh();
    }
    setLoading(null);
  };

  const handleReject = async (settlementId: string) => {
    if (!confirm("Tolak pelunasan ini? (Uang belum diterima)")) return;
    setLoading(`reject-${settlementId}`);
    setStatusMsg(null);

    const res = await rejectSettlement(groupId, settlementId);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: "Pelunasan ditolak. Pembayar dapat mencoba ulang.",
      });
      router.refresh();
    }
    setLoading(null);
  };

  const handleDirectSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directFrom || !directTo) {
      setStatusMsg({ type: "error", text: "Pilih pengirim dan penerima" });
      return;
    }
    if (directFrom === directTo) {
      setStatusMsg({ type: "error", text: "Pengirim dan penerima harus berbeda" });
      return;
    }
    const parsedAmount = parseInt(directAmount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      setStatusMsg({ type: "error", text: "Nominal harus lebih dari 0" });
      return;
    }

    setDirectSubmitting(true);
    setStatusMsg(null);

    const res = await recordDirectSettlement({
      groupId,
      fromMemberId: directFrom,
      toMemberId: directTo,
      amount: parsedAmount,
      note: directNote || "Pelunasan langsung dicatat owner",
    });

    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: `Pelunasan langsung ${formatRupiah(parsedAmount)} berhasil dicatat dan terkonfirmasi.`,
      });
      setShowDirectModal(false);
      setDirectAmount("");
      setDirectNote("");
      router.refresh();
    }
    setDirectSubmitting(false);
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="border-b-[3px] border-[#121212] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Penyelesaian & Pelunasan
          </h2>
          <p className="font-sans text-sm text-[#4b4731]">
            Transfer minimum hasil perhitungan saldo. Tandai pembayaran, lalu penerima mengonfirmasi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/settings"
            className="btn-brutal bg-[#f0edec] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
          >
            ⚙️ Atur Rekening/E-Wallet
          </Link>
          {currentMember.role === "owner" && (
            <button
              type="button"
              onClick={() => setShowDirectModal(true)}
              className="btn-brutal bg-[#FFE600] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              ⚡ Catat Langsung (Owner)
            </button>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {statusMsg && (
        <div
          className={`p-4 border-brutal-sm font-sans text-xs font-semibold flex items-center justify-between ${
            statusMsg.type === "success"
              ? "bg-[#00F090] text-[#121212]"
              : "bg-[#ffdad6] text-[#ba1a1a]"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            type="button"
            className="font-bold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* All Settled Banner */}
      {allLunas ? (
        <div className="bg-[#00F090] border-brutal shadow-brutal p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="font-display text-2xl font-bold mb-2">
            Semua Sudah Lunas!
          </h3>
          <p className="font-sans text-sm text-[#121212]">
            Tidak ada transfer yang perlu dilakukan. Semua saldo anggota sudah
            nol.
          </p>
        </div>
      ) : (
        <>
          {/* Suggested Transfers Cards */}
          <div className="bg-white border-brutal shadow-brutal">
            <div className="p-4 bg-[#FFE600] border-b-[3px] border-[#121212] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#121212] inline-block"></span>
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  Transfer yang Perlu Dilakukan ({suggestedTransfers.length})
                </span>
              </div>
              <span className="bg-white px-2 py-0.5 border-brutal-sm font-display text-xs font-bold uppercase">
                Minimum Transfer
              </span>
            </div>

            <div className="divide-y-[3px] divide-[#121212]">
              {suggestedTransfers.map((t, idx) => {
                const isPendingAlready = pendingSettlements.some(
                  (s) =>
                    s.fromMemberId === t.from &&
                    s.toMemberId === t.to &&
                    s.amount === t.amount,
                );
                const isDebtor = t.from === currentMember.id;
                const receiverPMs = getPaymentMethods(t.to);

                return (
                  <div key={idx} className="p-5">
                    {/* Transfer Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {/* From Avatar */}
                        <div className="w-10 h-10 bg-[#ffd8e9] border-brutal-sm flex items-center justify-center font-display text-xs font-bold">
                          {memberNameMap[t.from]?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-display text-sm font-bold">
                            {memberNameMap[t.from]}
                            {t.from === currentMember.id && (
                              <span className="bg-[#FFE600] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold ml-2">
                                KAMU
                              </span>
                            )}
                          </span>
                          <span className="font-sans text-xs text-[#7c775f] block">
                            membayar kepada
                          </span>
                        </div>

                        {/* Arrow */}
                        <span className="font-display text-lg font-bold text-[#121212]">
                          ➔
                        </span>

                        {/* To Avatar */}
                        <div className="w-10 h-10 bg-[#00F090] border-brutal-sm flex items-center justify-center font-display text-xs font-bold">
                          {memberNameMap[t.to]?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-display text-sm font-bold">
                            {memberNameMap[t.to]}
                            {t.to === currentMember.id && (
                              <span className="bg-[#FFE600] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold ml-2">
                                KAMU
                              </span>
                            )}
                          </span>
                          <span className="font-sans text-xs text-[#7c775f] block">
                            menerima
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-display text-2xl font-extrabold text-[#121212] block">
                          {formatRupiah(t.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Payment Info & Action */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end justify-between">
                      {/* Payment Methods of Receiver */}
                      {receiverPMs.length > 0 ? (
                        <div className="bg-[#f6f3f2] border-brutal-sm p-3 flex-1">
                          <span className="font-display text-[11px] font-bold uppercase block mb-2">
                            Info Pembayaran {memberNameMap[t.to]}:
                          </span>
                          <div className="space-y-1.5">
                            {receiverPMs.map((pm) => (
                              <div
                                key={pm.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="font-sans text-xs">
                                  {paymentTypeEmoji[pm.type] || "💳"}{" "}
                                  {pm.label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <code className="font-mono text-xs bg-white px-1.5 py-0.5 border-brutal-sm select-all">
                                    {pm.value}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigator.clipboard.writeText(pm.value)
                                    }
                                    className="px-1.5 py-0.5 border-brutal-sm bg-white font-display text-[10px] font-bold uppercase cursor-pointer hover:bg-[#FFE600]"
                                  >
                                    Salin
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FFF8E7] border-brutal-sm p-3 flex-1">
                          <span className="font-display text-[11px] font-bold uppercase text-[#854d0e] block mb-1">
                            ⚠️ Belum ada metode pembayaran
                          </span>
                          <p className="font-sans text-xs text-[#713f12]">
                            {memberNameMap[t.to]} belum mengatur nomor rekening atau e-wallet. Ingatkan teman untuk mengisi di menu Pengaturan.
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="shrink-0">
                        {isPendingAlready ? (
                          <span className="bg-[#FFE600] border-brutal-sm px-4 py-2 font-display text-xs font-bold uppercase inline-block">
                            ⏳ Menunggu Konfirmasi
                          </span>
                        ) : isDebtor ? (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(t)}
                            disabled={loading !== null}
                            className="btn-brutal bg-[#00F090] text-[#121212] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                          >
                            {loading === `mark-${t.from}-${t.to}`
                              ? "Memproses..."
                              : "✅ Sudah Transfer"}
                          </button>
                        ) : (
                          <span className="bg-[#f0edec] border-brutal-sm px-3 py-2 font-display text-[11px] font-bold uppercase inline-block text-[#7c775f]">
                            Transfer oleh {memberNameMap[t.from]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Pending Confirmations */}
      {pendingSettlements.length > 0 && (
        <div className="bg-white border-brutal shadow-brutal">
          <div className="p-4 bg-[#00D2FF] border-b-[3px] border-[#121212]">
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              ⏳ Menunggu Konfirmasi ({pendingSettlements.length})
            </span>
          </div>

          <div className="divide-y-2 divide-[#f0edec]">
            {pendingSettlements.map((s) => {
              const isReceiver = s.toMemberId === currentMember.id;
              const isOwner = currentMember.role === "owner";
              const canActon = isReceiver || isOwner;

              return (
                <div
                  key={s.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-display text-sm font-bold">
                        {memberNameMap[s.fromMemberId]} ➔{" "}
                        {memberNameMap[s.toMemberId]}
                      </span>
                      <span className="bg-[#FFE600] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold uppercase">
                        MENUNGGU
                      </span>
                    </div>
                    <div className="font-sans text-xs text-[#7c775f]">
                      {formatRupiah(s.amount)} •{" "}
                      {s.paidAt
                        ? new Date(s.paidAt).toLocaleDateString("id-ID")
                        : ""}
                      {s.note && ` • ${s.note}`}
                    </div>
                  </div>

                  {canActon && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleConfirm(s.id)}
                        disabled={loading !== null}
                        className="btn-brutal bg-[#00F090] text-[#121212] px-3 py-1.5 font-display text-[11px] font-bold uppercase cursor-pointer"
                      >
                        {loading === `confirm-${s.id}`
                          ? "..."
                          : "✅ Konfirmasi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(s.id)}
                        disabled={loading !== null}
                        className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-3 py-1.5 font-display text-[11px] font-bold uppercase cursor-pointer"
                      >
                        {loading === `reject-${s.id}` ? "..." : "❌ Tolak"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmed History */}
      {confirmedSettlements.length > 0 && (
        <div className="bg-white border-brutal shadow-brutal">
          <div className="p-4 bg-[#f0edec] border-b-[3px] border-[#121212]">
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              ✅ Riwayat Pelunasan Terkonfirmasi ({confirmedSettlements.length})
            </span>
          </div>

          <div className="divide-y-2 divide-[#f0edec]">
            {confirmedSettlements.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-display text-sm font-bold">
                    {memberNameMap[s.fromMemberId]} ➔{" "}
                    {memberNameMap[s.toMemberId]}
                  </span>
                  <div className="font-sans text-xs text-[#7c775f]">
                    {s.confirmedAt
                      ? new Date(s.confirmedAt).toLocaleDateString("id-ID")
                      : ""}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-display text-sm font-bold text-[#00a86b]">
                    {formatRupiah(s.amount)}
                  </span>
                  <span className="bg-[#00F090] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold uppercase block mt-0.5">
                    TERKONFIRMASI
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected History */}
      {rejectedSettlements.length > 0 && (
        <div className="bg-white border-brutal shadow-brutal">
          <div className="p-4 bg-[#ffdad6] border-b-[3px] border-[#121212]">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-[#ba1a1a]">
              ❌ Pelunasan Ditolak ({rejectedSettlements.length})
            </span>
          </div>

          <div className="divide-y-2 divide-[#f0edec]">
            {rejectedSettlements.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-display text-sm font-bold">
                    {memberNameMap[s.fromMemberId]} ➔{" "}
                    {memberNameMap[s.toMemberId]}
                  </span>
                  <div className="font-sans text-xs text-[#7c775f]">
                    {new Date(s.createdAt).toLocaleDateString("id-ID")}
                    {s.note && ` • ${s.note}`}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-display text-sm font-bold text-[#ba1a1a]">
                    {formatRupiah(s.amount)}
                  </span>
                  <span className="bg-[#ffdad6] text-[#ba1a1a] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold uppercase block mt-0.5">
                    DITOLAK
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Direct Settlement (Owner Only) */}
      {showDirectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-brutal shadow-brutal max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b-[3px] border-[#121212] pb-3 mb-4">
              <h3 className="font-display text-lg font-bold">
                ⚡ Catat Pelunasan Langsung
              </h3>
              <button
                type="button"
                onClick={() => setShowDirectModal(false)}
                className="font-bold text-lg hover:text-[#ba1a1a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="font-sans text-xs text-[#4b4731] mb-4">
              Sebagai owner, kamu dapat mencatat pembayaran tunai atau transfer di luar aplikasi yang sudah selesai. Saldo kedua pihak akan langsung terupdate.
            </p>

            <form onSubmit={handleDirectSettlement} className="space-y-4">
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">
                  Yang Membayar (Pengirim):
                </label>
                <select
                  value={directFrom}
                  onChange={(e) => setDirectFrom(e.target.value)}
                  className="w-full border-brutal-sm p-2 text-sm bg-white font-sans"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">
                  Yang Menerima:
                </label>
                <select
                  value={directTo}
                  onChange={(e) => setDirectTo(e.target.value)}
                  className="w-full border-brutal-sm p-2 text-sm bg-white font-sans"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">
                  Nominal (Rp):
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Contoh: 50000"
                  value={directAmount}
                  onChange={(e) => setDirectAmount(e.target.value)}
                  className="w-full border-brutal-sm p-2 text-sm font-sans"
                  required
                />
              </div>

              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">
                  Catatan (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Misal: Tunai saat makan siang"
                  value={directNote}
                  onChange={(e) => setDirectNote(e.target.value)}
                  className="w-full border-brutal-sm p-2 text-sm font-sans"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-[#121212]">
                <button
                  type="button"
                  onClick={() => setShowDirectModal(false)}
                  className="btn-brutal bg-[#f0edec] px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={directSubmitting}
                  className="btn-brutal bg-[#00F090] px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer"
                >
                  {directSubmitting ? "Menyimpan..." : "Simpan & Konfirmasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
