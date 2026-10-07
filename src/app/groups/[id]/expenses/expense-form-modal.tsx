"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/app/actions/expense";

interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

export function ExpenseFormModal({
  groupId,
  members,
  currentMemberId,
  onClose,
}: {
  groupId: string;
  members: Member[];
  currentMemberId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [spentAt, setSpentAt] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [category, setCategory] = useState("makanan");
  const [payerId, setPayerId] = useState(currentMemberId);
  const [note, setNote] = useState("");

  // Split weights: memberId -> weight (0, 0.5, 1, 2)
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const m of members) init[m.id] = 1; // default all included with weight 1 (US-D1)
    return init;
  });

  const rawAmount = parseInt(amountStr.replace(/\D/g, ""), 10) || 0;

  const handleSelectAll = () => {
    const next: Record<string, number> = {};
    for (const m of members) next[m.id] = 1;
    setWeights(next);
  };

  const handleClearAll = () => {
    const next: Record<string, number> = {};
    for (const m of members) next[m.id] = 0;
    setWeights(next);
  };

  const setMemberWeight = (mId: string, w: number) => {
    setWeights((prev) => ({ ...prev, [mId]: w }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rawAmount <= 0) {
      setErrorMsg("Nominal pengeluaran harus lebih besar dari 0");
      return;
    }

    const participants = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .map(([mId, w]) => ({ memberId: mId, weight: w }));

    if (participants.length === 0) {
      setErrorMsg("Pilih minimal satu orang yang menanggung pengeluaran ini.");
      return;
    }

    setLoading(true);
    const res = await createExpense({
      groupId,
      title: title.trim(),
      amount: rawAmount,
      spentAt,
      category,
      payerMemberId: payerId,
      note: note.trim() || undefined,
      participants,
    });

    if (!res.ok) {
      setErrorMsg(res.error.message);
      setLoading(false);
    } else {
      router.refresh();
      onClose();
    }
  };

  const activeParticipantsCount = Object.values(weights).filter(
    (w) => w > 0,
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-brutal shadow-brutal max-w-2xl w-full p-6 my-8 relative">
        <div className="flex items-center justify-between border-b-[3px] border-[#121212] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-[#FFE600] border-brutal-sm flex items-center justify-center font-display text-sm font-bold">
              ➕
            </span>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">
              Tambah Pengeluaran
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 bg-[#f0edec] border-brutal-sm font-display text-sm font-bold hover:bg-[#ffdad6] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="bg-[#ffdad6] border-brutal-sm p-3 mb-4 text-[#ba1a1a] font-sans text-xs font-semibold flex items-start gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Judul & Nominal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">
                Nama Pengeluaran <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mis. Sewa Jeep Bromo, Sate Ayam"
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2.5 font-sans text-sm outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">
                Nominal (Rupiah) <span className="text-[#ba1a1a]">*</span>
              </label>
              <div className="flex items-stretch border-brutal-sm bg-[#f6f3f2]">
                <span className="bg-[#FFE600] px-3 flex items-center justify-center border-r-2 border-[#121212] font-display text-xs font-bold">
                  Rp
                </span>
                <input
                  type="text"
                  required
                  value={
                    rawAmount > 0 ? rawAmount.toLocaleString("id-ID") : ""
                  }
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent p-2.5 font-display text-sm font-bold outline-none text-right"
                />
              </div>
            </div>
          </div>

          {/* Catatan / Keterangan */}
          <div>
            <label className="block font-display text-[11px] font-bold uppercase mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mis. Titip oleh-oleh, diskon voucher"
              className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none focus:bg-white"
            />
          </div>

          {/* Tanggal, Kategori, & Pembayar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
              />
            </div>

            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
              >
                <option value="makanan">🍔 Makanan</option>
                <option value="transport">🚗 Transport</option>
                <option value="penginapan">🏨 Penginapan</option>
                <option value="belanja">🛍️ Belanja</option>
                <option value="tiket">🎟️ Tiket</option>
                <option value="lainnya">📦 Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">
                Ditalangi Oleh <span className="text-[#ba1a1a]">*</span>
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-[#FFE600] border-brutal-sm p-2 font-display text-xs font-bold outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} {m.id === currentMemberId && "(Kamu)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Penentuan Bobot & Peserta */}
          <div className="border-[2px] border-[#121212] p-3.5 bg-[#fcf9f8]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#121212]">
              <div>
                <span className="font-display text-xs font-bold uppercase block">
                  Siapa yang Menanggung? ({activeParticipantsCount} dari{" "}
                  {members.length} Orang)
                </span>
                <span className="font-sans text-[11px] text-[#4b4731]">
                  Pilih bobot: 0 (skip), 0.5 (setengah), 1 (normal), 2 (double)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 border-brutal-sm bg-[#00F090] font-display text-[10px] font-bold uppercase cursor-pointer"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2 py-0.5 border-brutal-sm bg-[#ffdad6] font-display text-[10px] font-bold uppercase cursor-pointer"
                >
                  Batal Semua
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {members.map((m) => {
                const currentW = weights[m.id] ?? 0;
                return (
                  <div
                    key={m.id}
                    className="p-2 bg-white border-brutal-sm flex items-center justify-between gap-2"
                  >
                    <span className="font-display text-xs font-bold truncate">
                      {m.displayName}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {[0, 0.5, 1, 2].map((wOption) => (
                        <button
                          key={wOption}
                          type="button"
                          onClick={() => setMemberWeight(m.id, wOption)}
                          className={`px-2 py-1 font-display text-[11px] font-bold border-brutal-sm cursor-pointer transition-colors ${
                            currentW === wOption
                              ? wOption === 0
                                ? "bg-[#ffdad6] text-[#ba1a1a]"
                                : "bg-[#FFE600] text-[#121212]"
                              : "bg-white text-[#7c775f] hover:bg-[#f0edec]"
                          }`}
                        >
                          {wOption === 0 ? "Skip" : `${wOption}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-brutal bg-[#f0edec] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-brutal bg-[#00F090] text-[#121212] px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {loading ? "Menyimpan..." : "Simpan Pengeluaran ➔"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
