"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { ExpenseFormModal } from "./expenses/expense-form-modal";
import { ShareRecapModal } from "./share-recap-modal";
import { deleteExpense } from "@/app/actions/expense";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

interface Split {
  memberId: string;
  inputValue?: string;
  weight?: string;
  shareAmount: number;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string;
  note: string | null;
  createdByMemberId: string;
  payerMemberId: string;
  splits: Split[];
  payer?: { displayName: string };
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function RekapClientView({
  groupId,
  groupName = "Grup Patungan",
  currentMember,
  members,
  expenses,
  balances,
  transfers,
  paidMap,
  shareMap,
  totalExpense,
  categorySorted,
  isBalanced,
}: {
  groupId: string;
  groupName?: string;
  currentMember: Member;
  members: Member[];
  expenses: Expense[];
  balances: Record<string, number>;
  transfers: Transfer[];
  paidMap: Record<string, number>;
  shareMap: Record<string, number>;
  totalExpense: number;
  categorySorted: [string, number][];
  isBalanced: boolean;
}) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const memberNameMap = Object.fromEntries(
    members.map((m) => [m.id, m.displayName]),
  );

  const myBalance = balances[currentMember.id] || 0;

  // Filtered expenses list
  const filteredExpenses = expenses.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterPerson !== "all") {
      const isPayer = e.payerMemberId === filterPerson;
      const isParticipant = e.splits.some((s) => s.memberId === filterPerson);
      if (!isPayer && !isParticipant) return false;
    }
    return true;
  });

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Hapus catatan pengeluaran ini dari patungan?")) return;
    setLoadingId(expenseId);
    const res = await deleteExpense(groupId, expenseId);
    if (!res.ok) {
      alert(res.error.message);
    } else {
      router.refresh();
    }
    setLoadingId(null);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Personal Position (Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Total Group Expense (7 Cols) */}
        <div className="lg:col-span-7 bg-white border-brutal shadow-brutal flex flex-col justify-between">
          <div className="p-4 bg-[#f0edec] border-b-[3px] border-[#121212] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-[#FFE600] border-brutal-sm inline-block"></span>
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                Total Pengeluaran Patungan
              </span>
            </div>
            <span className="bg-white px-2 py-0.5 border-brutal-sm font-display text-xs font-bold uppercase">
              {expenses.length} Transaksi
            </span>
          </div>

          <div className="p-6">
            <span className="font-sans text-xs uppercase font-semibold text-[#7c775f] block mb-1">
              Akumulasi Tercatat
            </span>
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              {formatRupiah(totalExpense)}
            </div>
            <span className="font-sans text-xs text-[#7c775f] mt-2 block">
              Rata-rata:{" "}
              {members.length > 0
                ? formatRupiah(Math.round(totalExpense / members.length))
                : "Rp 0"}{" "}
              / orang
            </span>
          </div>

          <div className="p-3 bg-[#f0edec] border-t-[3px] border-[#121212] flex items-center justify-between text-xs font-display">
            <div className="flex items-center gap-1.5">
              <span>{isBalanced ? "✅" : "⚠️"}</span>
              <span className="font-bold">
                {isBalanced ? "Saldo Seimbang (Sum = 0)" : "Cek Data (Selisih Ada)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                type="button"
                className="btn-brutal bg-[#FFE600] text-[#121212] px-3 py-1 font-bold uppercase text-[11px] cursor-pointer flex items-center gap-1 shadow-brutal-xs hover:bg-[#ffe033]"
              >
                <span>📢</span> Bagikan Rekap
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                type="button"
                className="btn-brutal bg-[#00F090] text-[#121212] px-3 py-1 font-bold uppercase text-[11px] cursor-pointer"
              >
                ➕ Catat Baru
              </button>
            </div>
          </div>
        </div>

        {/* Personal Position Card (5 Cols) */}
        <div className="lg:col-span-5 bg-white border-brutal shadow-brutal flex flex-col justify-between">
          <div className="p-4 bg-[#FF66C4] text-[#121212] border-b-[3px] border-[#121212] flex items-center justify-between font-display font-bold text-xs uppercase tracking-wider">
            <span>Posisi Keuangan Kamu</span>
            <span className="bg-white px-2 py-0.5 border-brutal-sm">
              {currentMember.displayName}
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center">
            <span className="font-sans text-xs uppercase font-semibold text-[#7c775f] block mb-1">
              Status Saldo Akhir
            </span>
            <div
              className={`font-display text-3xl font-extrabold tracking-tight ${
                myBalance > 0
                  ? "text-[#00a86b]"
                  : myBalance < 0
                  ? "text-[#ad1d7f]"
                  : "text-[#121212]"
              }`}
            >
              {myBalance > 0
                ? `Menerima ${formatRupiah(myBalance)}`
                : myBalance < 0
                ? `Membayar ${formatRupiah(Math.abs(myBalance))}`
                : "Lunas (Rp 0)"}
            </div>

            <div className="mt-4 pt-3 border-t-2 border-[#f0edec] grid grid-cols-2 gap-2 text-xs font-sans text-[#7c775f]">
              <div>
                <span>Ditalangi: </span>
                <strong className="text-[#121212] font-display">
                  {formatRupiah(paidMap[currentMember.id] || 0)}
                </strong>
              </div>
              <div>
                <span>Tanggungan: </span>
                <strong className="text-[#121212] font-display">
                  {formatRupiah(shareMap[currentMember.id] || 0)}
                </strong>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#f0edec] border-t-[3px] border-[#121212]">
            <div className="font-display text-xs font-bold uppercase mb-1">
              Daftar Transfer Penyelesaian ({transfers.length}):
            </div>
            {transfers.length === 0 ? (
              <p className="font-sans text-xs text-[#00a86b] font-semibold">
                🎉 Semua saldo sudah lunas!
              </p>
            ) : (
              <div className="space-y-1">
                {transfers.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-white border-brutal-sm font-sans text-xs flex items-center justify-between"
                  >
                    <span>
                      <strong>{memberNameMap[t.from]}</strong> ➔{" "}
                      <strong>{memberNameMap[t.to]}</strong>
                    </span>
                    <strong className="font-display text-[#121212]">
                      {formatRupiah(t.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Tabel Saldo Tiap Orang (8 Cols) & Ringkasan Kategori (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table Saldo Anggota (8 Cols) */}
        <div
          id="tabel-saldo"
          className="lg:col-span-8 bg-white border-brutal shadow-brutal"
        >
          <div className="p-4 bg-[#f0edec] border-b-[3px] border-[#121212] flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase tracking-tight">
              Daftar Saldo Anggota
            </h3>
            <span className="font-sans text-xs text-[#7c775f]">
              Hitungan presisi tanpa desimal
            </span>
          </div>

          <div className="divide-y-2 divide-[#f0edec]">
            {members.map((m) => {
              const b = balances[m.id] || 0;
              const paid = paidMap[m.id] || 0;
              const share = shareMap[m.id] || 0;
              const isMe = m.id === currentMember.id;

              return (
                <div
                  key={m.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isMe ? "bg-[#FFFDF5]" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 border-brutal-sm flex items-center justify-center font-display text-xs font-bold ${
                        m.role === "owner" ? "bg-[#FFE600]" : "bg-[#00D2FF]"
                      }`}
                    >
                      {m.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold">
                          {m.displayName}
                        </span>
                        {isMe && (
                          <span className="bg-[#FFE600] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold">
                            KAMU
                          </span>
                        )}
                      </div>
                      <div className="font-sans text-xs text-[#7c775f] flex items-center gap-2">
                        <span>Dibayar: {formatRupiah(paid)}</span>
                        <span>•</span>
                        <span>Tanggungan: {formatRupiah(share)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right self-end sm:self-auto">
                    <span
                      className={`font-display text-sm font-bold block ${
                        b > 0
                          ? "text-[#00a86b]"
                          : b < 0
                          ? "text-[#ad1d7f]"
                          : "text-[#121212]"
                      }`}
                    >
                      {b > 0 ? `+${formatRupiah(b)}` : b < 0 ? formatRupiah(b) : "Rp 0"}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold uppercase inline-block mt-0.5 ${
                        b > 0
                          ? "bg-[#00F090] text-[#121212]"
                          : b < 0
                          ? "bg-[#ffd8e9] text-[#890063]"
                          : "bg-[#f0edec] text-[#7c775f]"
                      }`}
                    >
                      {b > 0 ? "Menerima" : b < 0 ? "Membayar" : "Lunas"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ringkasan Kategori (4 Cols) */}
        <div className="lg:col-span-4 bg-white border-brutal shadow-brutal p-6 space-y-4">
          <h3 className="font-display text-base font-bold uppercase tracking-tight border-b-2 border-[#121212] pb-2">
            Pengeluaran per Kategori
          </h3>

          {categorySorted.length === 0 ? (
            <p className="font-sans text-xs text-[#7c775f]">
              Belum ada data kategori.
            </p>
          ) : (
            <div className="space-y-3">
              {categorySorted.map(([cat, amt]) => {
                const percent =
                  totalExpense > 0
                    ? Math.round((amt / totalExpense) * 100)
                    : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-display">
                      <span className="font-bold uppercase">{cat}</span>
                      <span>
                        {formatRupiah(amt)} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 bg-[#f0edec] border-brutal-sm overflow-hidden">
                      <div
                        className="h-full bg-[#00D2FF]"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Daftar Pengeluaran & Filter */}
      <div className="bg-white border-brutal shadow-brutal p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#121212] pb-4 mb-4">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-tight">
              Catatan Pengeluaran ({filteredExpenses.length})
            </h3>
            <p className="font-sans text-xs text-[#7c775f]">
              Daftar transaksi yang dibagi ke anggota.
            </p>
          </div>

          {/* Filter options */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#f6f3f2] border-brutal-sm p-1.5 font-sans text-xs outline-none"
            >
              <option value="all">Semua Kategori</option>
              <option value="makanan">Makanan</option>
              <option value="transport">Transport</option>
              <option value="penginapan">Penginapan</option>
              <option value="belanja">Belanja</option>
              <option value="tiket">Tiket</option>
              <option value="lainnya">Lainnya</option>
            </select>

            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="bg-[#f6f3f2] border-brutal-sm p-1.5 font-sans text-xs outline-none"
            >
              <option value="all">Semua Anggota</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8 font-sans text-xs text-[#7c775f]">
            Tidak ada pengeluaran yang cocok dengan filter.
          </div>
        ) : (
          <div className="divide-y-2 divide-[#f0edec]">
            {filteredExpenses.map((e) => {
              const canEdit =
                e.createdByMemberId === currentMember.id ||
                currentMember.role === "owner";

              return (
                <div
                  key={e.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-[#121212]">
                        {e.title}
                      </span>
                      <span className="bg-[#f0edec] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold uppercase">
                        {e.category}
                      </span>
                    </div>

                    <p className="font-sans text-xs text-[#7c775f]">
                      Ditalangi oleh{" "}
                      <strong>
                        {memberNameMap[e.payerMemberId] || "Anggota"}
                      </strong>{" "}
                      • {e.spentAt} • {e.splits.length} orang menanggung
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="font-display text-sm font-bold text-[#121212]">
                      {formatRupiah(e.amount)}
                    </span>

                    {canEdit && (
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        disabled={loadingId === e.id}
                        type="button"
                        className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-2 py-1 font-display text-[10px] font-bold uppercase cursor-pointer"
                      >
                        {loadingId === e.id ? "..." : "Hapus"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Pengeluaran */}
      {showAddModal && (
        <ExpenseFormModal
          groupId={groupId}
          members={members}
          currentMemberId={currentMember.id}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Modal Bagikan Rekap */}
      <ShareRecapModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        groupId={groupId}
        groupName={groupName}
        totalExpenses={totalExpense}
        members={members}
        balances={balances}
        transfers={transfers}
        isOwner={currentMember.role === "owner"}
      />
    </div>
  );
}
