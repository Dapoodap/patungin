"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { createExpense } from "@/app/actions/expense";
import { allocItems, ItemInput, AdjustmentInput } from "@/lib/split";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

interface ExpenseFormModalProps {
  groupId: string;
  members: Member[];
  currentMemberId: string;
  onClose: () => void;
}

interface ReceiptItemState {
  id: string;
  name: string;
  amountStr: string;
  shares: Record<string, number>; // memberId -> 1 / 0
}

interface ReceiptAdjustmentState {
  kind: "tax" | "service" | "tip" | "discount";
  amountStr: string;
  allocation: "proportional" | "equal";
}

export function ExpenseFormModal({
  groupId,
  members,
  currentMemberId,
  onClose,
}: ExpenseFormModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [spentAt, setSpentAt] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [category, setCategory] = useState("makanan");
  const [payerId, setPayerId] = useState(currentMemberId);
  const [note, setNote] = useState("");

  // Mode pembagian: weight | percent | exact | items
  const [splitMode, setSplitMode] = useState<
    "weight" | "percent" | "exact" | "items"
  >("weight");

  // Split weights: memberId -> weight (0, 0.5, 1, 2)
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const m of members) init[m.id] = 1;
    return init;
  });

  // Split percentages: memberId -> string (e.g. "33.33")
  const [percentages, setPercentages] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const defaultPct = (100 / members.length).toFixed(2);
    for (const m of members) init[m.id] = defaultPct;
    return init;
  });

  // Split exact: memberId -> string rupiah (e.g. "50000")
  const [exacts, setExacts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of members) init[m.id] = "";
    return init;
  });

  // Receipt Items state for 'items' mode
  const [receiptItems, setReceiptItems] = useState<ReceiptItemState[]>([
    {
      id: "item-1",
      name: "Menu 1",
      amountStr: "",
      shares: Object.fromEntries(members.map((m) => [m.id, 1])),
    },
  ]);

  const [receiptAdjustments, setReceiptAdjustments] = useState<
    ReceiptAdjustmentState[]
  >([
    { kind: "service", amountStr: "", allocation: "proportional" },
    { kind: "tax", amountStr: "", allocation: "proportional" },
    { kind: "discount", amountStr: "", allocation: "equal" },
  ]);

  // Calculations for Receipt Items mode
  const itemsSubtotal = receiptItems.reduce((sum, item) => {
    const amt = parseInt(item.amountStr.replace(/\D/g, ""), 10) || 0;
    return sum + amt;
  }, 0);

  const adjustmentsAddTotal = receiptAdjustments
    .filter((a) => a.kind !== "discount")
    .reduce((sum, a) => {
      const amt = parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0;
      return sum + amt;
    }, 0);

  const adjustmentsDiscTotal = receiptAdjustments
    .filter((a) => a.kind === "discount")
    .reduce((sum, a) => {
      const amt = parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0;
      return sum + amt;
    }, 0);

  const receiptGrandTotal =
    itemsSubtotal + adjustmentsAddTotal - adjustmentsDiscTotal;

  const rawAmount =
    splitMode === "items"
      ? receiptGrandTotal
      : parseInt(amountStr.replace(/\D/g, ""), 10) || 0;

  // Helpers for Weight mode
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

  // Helpers for Percent mode
  const totalPercent = Object.values(percentages).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0,
  );
  const isPercentValid = Math.abs(totalPercent - 100) <= 0.001;

  const handleEqualizePercent = () => {
    const activeIds = Object.keys(percentages).filter(
      (id) => parseFloat(percentages[id]) > 0,
    );
    const targetIds =
      activeIds.length > 0 ? activeIds : members.map((m) => m.id);
    const equalShare = (100 / targetIds.length).toFixed(2);
    const next: Record<string, string> = {};
    for (const m of members) {
      next[m.id] = targetIds.includes(m.id) ? equalShare : "0";
    }
    setPercentages(next);
  };

  // Helpers for Exact mode
  const totalExact = Object.values(exacts).reduce((sum, val) => {
    const num = parseInt(val.replace(/\D/g, ""), 10) || 0;
    return sum + num;
  }, 0);
  const exactDiff = rawAmount - totalExact;
  const isExactValid = rawAmount > 0 && exactDiff === 0;

  const handleEqualizeExact = () => {
    if (rawAmount <= 0) return;
    const baseShare = Math.floor(rawAmount / members.length);
    let rest = rawAmount - baseShare * members.length;
    const next: Record<string, string> = {};
    for (const m of members) {
      const share = rest > 0 ? baseShare + 1 : baseShare;
      if (rest > 0) rest -= 1;
      next[m.id] = share.toString();
    }
    setExacts(next);
  };

  // Helpers for Items mode
  const handleAddReceiptItem = () => {
    setReceiptItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: `Menu ${prev.length + 1}`,
        amountStr: "",
        shares: Object.fromEntries(members.map((m) => [m.id, 1])),
      },
    ]);
  };

  const handleRemoveReceiptItem = (id: string) => {
    if (receiptItems.length <= 1) return;
    setReceiptItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleItemMember = (itemId: string, memberId: string) => {
    setReceiptItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const current = item.shares[memberId] || 0;
        return {
          ...item,
          shares: {
            ...item.shares,
            [memberId]: current > 0 ? 0 : 1,
          },
        };
      }),
    );
  };

  // Preview allocation for receipt mode
  let itemsLivePreview: Record<string, number> = {};
  if (splitMode === "items" && receiptItems.length > 0) {
    try {
      const validItems: ItemInput[] = receiptItems
        .filter(
          (i) =>
            (parseInt(i.amountStr.replace(/\D/g, ""), 10) || 0) > 0 &&
            Object.values(i.shares).some((v) => v > 0),
        )
        .map((i) => ({
          name: i.name,
          amount: parseInt(i.amountStr.replace(/\D/g, ""), 10) || 0,
          shares: Object.fromEntries(
            Object.entries(i.shares).filter(([, v]) => v > 0),
          ),
        }));

      const validAdjustments: AdjustmentInput[] = receiptAdjustments
        .filter(
          (a) => (parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0) > 0,
        )
        .map((a) => ({
          kind: a.kind,
          amount: parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0,
          allocation: a.allocation,
        }));

      if (validItems.length > 0) {
        itemsLivePreview = allocItems(
          validItems,
          validAdjustments,
          members.map((m) => m.id),
        );
      }
    } catch {
      // Ignore preview calculation errors while typing
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rawAmount <= 0) {
      setErrorMsg("Nominal pengeluaran harus lebih besar dari 0.");
      return;
    }

    let participants: Array<{ memberId: string; inputValue: number }> = [];
    let itemsPayload: ItemInput[] | undefined = undefined;
    let adjustmentsPayload: AdjustmentInput[] | undefined = undefined;

    if (splitMode === "weight") {
      participants = Object.entries(weights)
        .filter(([, w]) => w > 0)
        .map(([mId, w]) => ({ memberId: mId, inputValue: w }));

      if (participants.length === 0) {
        setErrorMsg(
          "Pilih minimal satu orang yang menanggung pengeluaran ini.",
        );
        return;
      }
    } else if (splitMode === "percent") {
      if (!isPercentValid) {
        setErrorMsg(
          `Total persentase harus tepat 100,00% (saat ini ${totalPercent.toFixed(2)}%). Silakan sesuaikan.`,
        );
        return;
      }
      participants = Object.entries(percentages)
        .filter(([, pStr]) => (parseFloat(pStr) || 0) > 0)
        .map(([mId, pStr]) => ({
          memberId: mId,
          inputValue: parseFloat(pStr) || 0,
        }));
    } else if (splitMode === "exact") {
      if (!isExactValid) {
        setErrorMsg(
          `Total rincian nominal (${formatRupiah(totalExact)}) harus sama persis dengan total pengeluaran (${formatRupiah(rawAmount)}). Selisih: ${formatRupiah(Math.abs(exactDiff))}`,
        );
        return;
      }
      participants = Object.entries(exacts)
        .filter(([, val]) => (parseInt(val.replace(/\D/g, ""), 10) || 0) > 0)
        .map(([mId, val]) => ({
          memberId: mId,
          inputValue: parseInt(val.replace(/\D/g, ""), 10) || 0,
        }));
    } else if (splitMode === "items") {
      // Validate items
      const validItems: ItemInput[] = [];
      for (const item of receiptItems) {
        const amt = parseInt(item.amountStr.replace(/\D/g, ""), 10) || 0;
        if (amt <= 0) {
          setErrorMsg(`Harga item "${item.name}" harus lebih dari 0.`);
          return;
        }
        const activeShares = Object.fromEntries(
          Object.entries(item.shares).filter(([, v]) => v > 0),
        );
        if (Object.keys(activeShares).length === 0) {
          setErrorMsg(
            `Pilih minimal 1 orang yang ikut memesan item "${item.name}".`,
          );
          return;
        }
        validItems.push({
          name: item.name.trim() || "Item Struk",
          amount: amt,
          shares: activeShares,
        });
      }

      const validAdjustments: AdjustmentInput[] = receiptAdjustments
        .filter(
          (a) => (parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0) > 0,
        )
        .map((a) => ({
          kind: a.kind,
          amount: parseInt(a.amountStr.replace(/\D/g, ""), 10) || 0,
          allocation: a.allocation,
        }));

      if (validItems.length === 0) {
        setErrorMsg("Tambahkan minimal 1 baris item belanja struk.");
        return;
      }

      itemsPayload = validItems;
      adjustmentsPayload = validAdjustments;
    }

    setLoading(true);
    const res = await createExpense({
      groupId,
      title: title.trim(),
      amount: rawAmount,
      spentAt,
      category,
      payerMemberId: payerId,
      splitMode,
      note: note.trim() || undefined,
      participants,
      items: itemsPayload,
      adjustments: adjustmentsPayload,
    });

    if (!res.ok) {
      setErrorMsg(res.error.message);
      setLoading(false);
    } else {
      router.refresh();
      onClose();
    }
  };

  const activeParticipantsCount =
    splitMode === "weight"
      ? Object.values(weights).filter((w) => w > 0).length
      : splitMode === "percent"
        ? Object.values(percentages).filter((p) => (parseFloat(p) || 0) > 0)
            .length
        : splitMode === "exact"
          ? Object.values(exacts).filter(
              (val) => (parseInt(val.replace(/\D/g, ""), 10) || 0) > 0,
            ).length
          : members.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-brutal shadow-brutal max-w-2xl w-full p-6 my-8 relative max-h-[90vh] overflow-y-auto">
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
            className="w-8 h-8 bg-[#f6f3f2] border-brutal-sm flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-[#ba1a1a] hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="bg-[#ffdad6] border-[2px] border-[#ba1a1a] text-[#410002] p-3 mb-4 text-xs font-bold font-sans">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Judul & Nominal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">
                Nama Pengeluaran <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="mis. Makan Siang, Grab, Bensin"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2.5 font-sans text-sm outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">
                Total Biaya (Rp) <span className="text-[#ba1a1a]">*</span>
                {splitMode === "items" && (
                  <span className="text-emerald-700 text-[10px] ml-1">
                    (Otomatis dari Struk)
                  </span>
                )}
              </label>
              <input
                type="text"
                required={splitMode !== "items"}
                readOnly={splitMode === "items"}
                placeholder="mis. 150000"
                value={
                  rawAmount > 0
                    ? formatRupiah(rawAmount).replace("Rp ", "")
                    : ""
                }
                onChange={(e) => setAmountStr(e.target.value)}
                className={`w-full border-brutal-sm p-2.5 font-display text-sm font-bold outline-none ${
                  splitMode === "items"
                    ? "bg-[#e8f5e9] text-emerald-900 cursor-not-allowed"
                    : "bg-[#f6f3f2] focus:bg-white"
                }`}
              />
            </div>
          </div>

          {/* Tanggal, Kategori, Pembayar */}
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
                Dibayar Oleh
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} {m.id === currentMemberId ? "(Saya)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Mode Pembagian & Peserta */}
          <div className="border-[2px] border-[#121212] p-3.5 bg-[#fcf9f8]">
            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap border-[2px] border-[#121212] bg-[#f0edec] mb-3">
              <button
                type="button"
                onClick={() => setSplitMode("weight")}
                className={`flex-1 py-1.5 px-2 font-display text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  splitMode === "weight"
                    ? "bg-[#FFE600] text-[#121212] border-r-2 border-[#121212]"
                    : "text-[#7c775f] hover:bg-white/50 border-r-2 border-[#121212]"
                }`}
              >
                ⚖️ Bobot Porsi
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("percent")}
                className={`flex-1 py-1.5 px-2 font-display text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  splitMode === "percent"
                    ? "bg-[#FFE600] text-[#121212] border-r-2 border-[#121212]"
                    : "text-[#7c775f] hover:bg-white/50 border-r-2 border-[#121212]"
                }`}
              >
                % Persentase
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("exact")}
                className={`flex-1 py-1.5 px-2 font-display text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  splitMode === "exact"
                    ? "bg-[#FFE600] text-[#121212] border-r-2 border-[#121212]"
                    : "text-[#7c775f] hover:bg-white/50 border-r-2 border-[#121212]"
                }`}
              >
                💵 Nominal Pas
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("items")}
                className={`flex-1 py-1.5 px-2 font-display text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  splitMode === "items"
                    ? "bg-[#FFE600] text-[#121212]"
                    : "text-[#7c775f] hover:bg-white/50"
                }`}
              >
                🧾 Item Struk
              </button>
            </div>

            {/* Header info per mode */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#121212]">
              <div>
                <span className="font-display text-xs font-bold uppercase block">
                  {splitMode === "items"
                    ? "Rincian Item Struk Belanja & Penyesuaian"
                    : `Siapa yang Menanggung? (${activeParticipantsCount} dari ${members.length} Orang)`}
                </span>
                <span className="font-sans text-[11px] text-[#4b4731]">
                  {splitMode === "weight" &&
                    "Pilih bobot: 0 (skip), 0.5 (setengah), 1 (normal), 2 (double)"}
                  {splitMode === "percent" &&
                    `Total persentase: ${totalPercent.toFixed(2)}% ${
                      isPercentValid
                        ? "✅ (Tepat 100%)"
                        : "⚠️ (Wajib pas 100,00%)"
                    }`}
                  {splitMode === "exact" &&
                    `Total diisi: ${formatRupiah(totalExact)} / ${formatRupiah(rawAmount)} ${
                      isExactValid
                        ? "✅ (Pas)"
                        : `(Selisih: ${formatRupiah(exactDiff)})`
                    }`}
                  {splitMode === "items" &&
                    "Masukkan setiap menu belanja dan centang siapa yang ikut menikmatinya"}
                </span>
              </div>

              {splitMode === "weight" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="btn-brutal bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="btn-brutal bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}

              {splitMode === "percent" && (
                <button
                  type="button"
                  onClick={handleEqualizePercent}
                  className="btn-brutal bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase cursor-pointer"
                >
                  Bagi Rata %
                </button>
              )}

              {splitMode === "exact" && (
                <button
                  type="button"
                  onClick={handleEqualizeExact}
                  className="btn-brutal bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase cursor-pointer"
                >
                  Bagi Rata Rp
                </button>
              )}
            </div>

            {/* TAB CONTENT: Weight Mode */}
            {splitMode === "weight" && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {members.map((m) => {
                  const w = weights[m.id] ?? 0;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-2 border-brutal-sm transition-colors ${
                        w > 0 ? "bg-white" : "bg-[#f0edec] opacity-60"
                      }`}
                    >
                      <span className="font-sans text-xs font-bold">
                        {m.displayName}
                      </span>
                      <div className="flex items-center gap-1">
                        {[0, 0.5, 1, 2].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setMemberWeight(m.id, val)}
                            className={`w-9 h-7 font-display text-[11px] font-bold border-brutal-sm cursor-pointer transition-colors ${
                              w === val
                                ? "bg-[#FFE600] text-[#121212]"
                                : "bg-white text-[#7c775f] hover:bg-[#FFE600]/40"
                            }`}
                          >
                            {val === 0 ? "0" : val}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: Percent Mode */}
            {splitMode === "percent" && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {members.map((m) => {
                  const pVal = percentages[m.id] || "";
                  const pNum = parseFloat(pVal) || 0;
                  const estimatedRp =
                    rawAmount > 0 ? Math.round((rawAmount * pNum) / 100) : 0;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-2 border-brutal-sm transition-colors ${
                        pNum > 0 ? "bg-white" : "bg-[#f0edec] opacity-60"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-sans text-xs font-bold">
                          {m.displayName}
                        </span>
                        {rawAmount > 0 && pNum > 0 && (
                          <span className="font-mono text-[10px] text-neutral-500">
                            ~{formatRupiah(estimatedRp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={pVal}
                          onChange={(e) =>
                            setPercentages({
                              ...percentages,
                              [m.id]: e.target.value,
                            })
                          }
                          className="w-20 bg-[#f6f3f2] border-brutal-sm p-1 text-right font-mono text-xs font-bold outline-none focus:bg-white"
                          placeholder="0.00"
                        />
                        <span className="font-display text-xs font-bold">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: Exact Mode */}
            {splitMode === "exact" && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {members.map((m) => {
                  const eVal = exacts[m.id] || "";
                  const eNum = parseInt(eVal.replace(/\D/g, ""), 10) || 0;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-2 border-brutal-sm transition-colors ${
                        eNum > 0 ? "bg-white" : "bg-[#f0edec] opacity-60"
                      }`}
                    >
                      <span className="font-sans text-xs font-bold">
                        {m.displayName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-xs font-bold text-neutral-500">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={
                            eNum > 0
                              ? formatRupiah(eNum).replace("Rp ", "")
                              : ""
                          }
                          onChange={(e) =>
                            setExacts({
                              ...exacts,
                              [m.id]: e.target.value,
                            })
                          }
                          className="w-28 bg-[#f6f3f2] border-brutal-sm p-1 text-right font-mono text-xs font-bold outline-none focus:bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: Receipt Items Mode */}
            {splitMode === "items" && (
              <div className="space-y-4">
                {/* Items List */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {receiptItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white border-2 border-black rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              setReceiptItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? { ...it, name: e.target.value }
                                    : it,
                                ),
                              )
                            }
                            placeholder="Nama Item (mis. Nasi Goreng)"
                            className="flex-1 bg-[#f6f3f2] border border-black p-1.5 font-bold text-xs rounded"
                          />
                          <input
                            type="text"
                            value={
                              item.amountStr
                                ? formatRupiah(
                                    parseInt(
                                      item.amountStr.replace(/\D/g, ""),
                                      10,
                                    ) || 0,
                                  ).replace("Rp ", "")
                                : ""
                            }
                            onChange={(e) =>
                              setReceiptItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? { ...it, amountStr: e.target.value }
                                    : it,
                                ),
                              )
                            }
                            placeholder="Harga Rp"
                            className="w-24 bg-[#f6f3f2] border border-black p-1.5 font-bold text-xs text-right rounded"
                          />
                        </div>
                        {receiptItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveReceiptItem(item.id)}
                            className="text-rose-600 hover:text-rose-800 font-black text-sm px-1"
                            title="Hapus baris item"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Participant chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-200">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase mr-1">
                          Peserta:
                        </span>
                        {members.map((m) => {
                          const isChecked = (item.shares[m.id] || 0) > 0;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleItemMember(item.id, m.id)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-[#FFE600] border-black text-black"
                                  : "bg-neutral-100 border-neutral-300 text-neutral-500 hover:bg-neutral-200"
                              }`}
                            >
                              {m.displayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddReceiptItem}
                  className="w-full py-2 bg-white border-2 border-black border-dashed font-bold text-xs uppercase hover:bg-neutral-50 cursor-pointer rounded-lg"
                >
                  ➕ Tambah Baris Item Belanja
                </button>

                {/* Adjustments: Tax, Service, Discount */}
                <div className="p-3 bg-[#FFFDF5] border-2 border-black rounded-lg space-y-2.5">
                  <span className="text-xs font-black uppercase text-neutral-700 block">
                    Penyesuaian Biaya Struk (Opsional):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {receiptAdjustments.map((adj, idx) => (
                      <div
                        key={adj.kind}
                        className="bg-white border border-black p-2 rounded text-xs space-y-1"
                      >
                        <span className="font-bold uppercase text-[11px] block">
                          {adj.kind === "service" && "🛎️ Service Charge"}
                          {adj.kind === "tax" && "🏛️ Pajak (PPN)"}
                          {adj.kind === "discount" && "🏷️ Diskon"}
                        </span>
                        <input
                          type="text"
                          placeholder="Nominal Rp"
                          value={
                            adj.amountStr
                              ? formatRupiah(
                                  parseInt(
                                    adj.amountStr.replace(/\D/g, ""),
                                    10,
                                  ) || 0,
                                ).replace("Rp ", "")
                              : ""
                          }
                          onChange={(e) =>
                            setReceiptAdjustments((prev) =>
                              prev.map((a, i) =>
                                i === idx
                                  ? { ...a, amountStr: e.target.value }
                                  : a,
                              ),
                            )
                          }
                          className="w-full bg-[#f6f3f2] border border-neutral-300 p-1 text-right font-mono text-xs font-bold rounded"
                        />
                        <select
                          value={adj.allocation}
                          onChange={(e) =>
                            setReceiptAdjustments((prev) =>
                              prev.map((a, i) =>
                                i === idx
                                  ? {
                                      ...a,
                                      allocation: e.target
                                        .value as "proportional" | "equal",
                                    }
                                  : a,
                              ),
                            )
                          }
                          className="w-full text-[10px] font-bold bg-[#f6f3f2] border border-neutral-300 p-1 rounded"
                        >
                          <option value="proportional">Proporsional</option>
                          <option value="equal">Bagi Rata</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Summary & Live Preview */}
                  <div className="pt-2 border-t border-neutral-300 flex flex-wrap justify-between items-center text-xs font-bold">
                    <span>
                      Subtotal Item: {formatRupiah(itemsSubtotal)}
                    </span>
                    <span className="text-emerald-800">
                      Grand Total Struk: {formatRupiah(receiptGrandTotal)}
                    </span>
                  </div>

                  {Object.keys(itemsLivePreview).length > 0 && (
                    <div className="pt-2 border-t border-neutral-200">
                      <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
                        Pratinjau Bagian per Anggota:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="text-[11px] px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded font-medium"
                          >
                            {m.displayName}:{" "}
                            {formatRupiah(itemsLivePreview[m.id] || 0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block font-display text-[11px] font-bold uppercase mb-1">
              Catatan (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Catatan tambahan misal: belum termasuk tip, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none focus:bg-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t-[3px] border-[#121212]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-brutal bg-white px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-brutal bg-[#FFE600] px-5 py-2 font-display text-xs font-bold uppercase cursor-pointer shadow-brutal hover:bg-[#FFE600]/90 disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan Pengeluaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
