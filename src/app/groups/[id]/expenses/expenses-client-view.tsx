"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";
import { deleteExpense } from "@/app/actions/expense";
import { ExpenseFormModal } from "./expense-form-modal";

interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

interface Split {
  memberId: string;
  weight: string;
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

const categoryEmoji: Record<string, string> = {
  makanan: "🍔",
  transport: "🚗",
  penginapan: "🏨",
  belanja: "🛍️",
  tiket: "🎟️",
  lainnya: "📦",
};

export function ExpensesClientView({
  groupId,
  currentMember,
  members,
  expenses,
}: {
  groupId: string;
  currentMember: Member;
  members: Member[];
  expenses: Expense[];
}) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const memberNameMap = Object.fromEntries(
    members.map((m) => [m.id, m.displayName]),
  );

  const filteredExpenses = expenses.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterPerson !== "all") {
      const isPayer = e.payerMemberId === filterPerson;
      const isParticipant = e.splits.some((s) => s.memberId === filterPerson);
      if (!isPayer && !isParticipant) return false;
    }
    return true;
  });

  const totalFiltered = filteredExpenses.reduce((s, e) => s + e.amount, 0);

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
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[3px] border-[#121212] pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Daftar Pengeluaran
          </h2>
          <p className="font-sans text-sm text-[#4b4731]">
            Catatan semua pengeluaran yang dibagi ke anggota grup.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          type="button"
          className="btn-brutal bg-[#00F090] text-[#121212] px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-2"
        >
          <span>➕</span>
          <span>Catat Pengeluaran</span>
        </button>
      </div>

      {/* Filters & Stats */}
      <div className="bg-white border-brutal shadow-brutal p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
          >
            <option value="all">Semua Kategori</option>
            <option value="makanan">🍔 Makanan</option>
            <option value="transport">🚗 Transport</option>
            <option value="penginapan">🏨 Penginapan</option>
            <option value="belanja">🛍️ Belanja</option>
            <option value="tiket">🎟️ Tiket</option>
            <option value="lainnya">📦 Lainnya</option>
          </select>

          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
          >
            <option value="all">Semua Anggota</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 font-display text-xs font-bold">
          <span className="bg-[#f0edec] px-3 py-1 border-brutal-sm">
            {filteredExpenses.length} Transaksi
          </span>
          <span className="bg-[#FFE600] px-3 py-1 border-brutal-sm">
            Total: {formatRupiah(totalFiltered)}
          </span>
        </div>
      </div>

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white border-brutal shadow-brutal p-8 text-center">
          <div className="w-16 h-16 bg-[#FFE600] border-brutal flex items-center justify-center font-display text-3xl mx-auto mb-4">
            📝
          </div>
          <h3 className="font-display text-xl font-bold mb-2">
            Belum Ada Pengeluaran
          </h3>
          <p className="font-sans text-sm text-[#4b4731] mb-6">
            Mulai catat pengeluaran pertama untuk menghitung pembagian yang adil.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            type="button"
            className="btn-brutal bg-[#00F090] text-[#121212] py-3 px-6 font-display text-sm font-bold uppercase tracking-wider cursor-pointer"
          >
            Catat Pengeluaran Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white border-brutal shadow-brutal">
          <div className="divide-y-2 divide-[#f0edec]">
            {filteredExpenses.map((e) => {
              const canEdit =
                e.createdByMemberId === currentMember.id ||
                currentMember.role === "owner";
              const isExpanded = expandedId === e.id;

              return (
                <div key={e.id} className="group">
                  {/* Main Row */}
                  <div
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#FFFDF5]"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : e.id)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#f0edec] border-brutal-sm flex items-center justify-center font-display text-lg shrink-0">
                        {categoryEmoji[e.category] || "📦"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
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

                        {e.note && (
                          <p className="font-sans text-xs text-[#7c775f] italic mt-0.5">
                            &ldquo;{e.note}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="font-display text-base font-bold text-[#121212]">
                        {formatRupiah(e.amount)}
                      </span>

                      {canEdit && (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleDeleteExpense(e.id);
                          }}
                          disabled={loadingId === e.id}
                          type="button"
                          className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-2 py-1 font-display text-[10px] font-bold uppercase cursor-pointer"
                        >
                          {loadingId === e.id ? "..." : "Hapus"}
                        </button>
                      )}

                      <span className="font-display text-xs text-[#7c775f]">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Detail: Split Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-[#FFFDF5] border-t-2 border-[#f0edec]">
                      <div className="pt-3">
                        <span className="font-display text-[11px] font-bold uppercase text-[#7c775f] block mb-2">
                          Rincian Pembagian:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {e.splits
                            .sort((a, b) => b.shareAmount - a.shareAmount)
                            .map((s) => (
                              <div
                                key={s.memberId}
                                className="p-2 bg-white border-brutal-sm flex items-center justify-between"
                              >
                                <span className="font-sans text-xs">
                                  {memberNameMap[s.memberId]}
                                  {s.memberId === currentMember.id && (
                                    <span className="bg-[#FFE600] px-1 py-0.5 border-brutal-sm font-display text-[9px] font-bold ml-1.5">
                                      KAMU
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-sans text-[10px] text-[#7c775f]">
                                    ×{parseFloat(s.weight)}
                                  </span>
                                  <span className="font-display text-xs font-bold">
                                    {formatRupiah(s.shareAmount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Tambah Pengeluaran */}
      {showAddModal && (
        <ExpenseFormModal
          groupId={groupId}
          members={members}
          currentMemberId={currentMember.id}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
