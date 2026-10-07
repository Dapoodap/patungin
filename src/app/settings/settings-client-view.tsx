"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  addPaymentMethodForUser,
  deletePaymentMethod,
} from "@/app/actions/payment-method";

interface PaymentMethod {
  id: string;
  memberId: string;
  type: string;
  label: string;
  value: string;
}

interface GroupInfo {
  id: string;
  name: string;
}

interface Membership {
  id: string;
  groupId: string;
  displayName: string;
  role: "owner" | "member";
  group: GroupInfo;
  paymentMethods: PaymentMethod[];
}

interface UserInfo {
  id: string;
  name?: string | null;
  email?: string | null;
}

const TYPE_OPTIONS = [
  { value: "bank", label: "Bank Transfer", emoji: "🏦" },
  { value: "gopay", label: "GoPay", emoji: "💚" },
  { value: "shopeepay", label: "ShopeePay", emoji: "🧡" },
  { value: "dana", label: "DANA", emoji: "💙" },
  { value: "ovo", label: "OVO", emoji: "💜" },
  { value: "qris", label: "QRIS", emoji: "📱" },
  { value: "other", label: "Lainnya", emoji: "💳" },
] as const;

export function SettingsClientView({
  user,
  memberships,
}: {
  user: UserInfo;
  memberships: Membership[];
}) {
  const router = useRouter();

  // Add payment method form state
  const [type, setType] = useState<
    "gopay" | "shopeepay" | "dana" | "ovo" | "bank" | "qris" | "other"
  >("bank");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [targetMemberId, setTargetMemberId] = useState<string>(""); // empty = all groups

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !value.trim()) {
      setStatusMsg({
        type: "error",
        text: "Label dan nomor/identitas harus diisi",
      });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    const res = await addPaymentMethodForUser({
      type,
      label: label.trim(),
      value: value.trim(),
      targetMemberId: targetMemberId || undefined,
    });

    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: `Metode pembayaran "${label}" berhasil disimpan!`,
      });
      setLabel("");
      setValue("");
      router.refresh();
    }
    setLoading(false);
  };

  const handleDelete = async (pmId: string) => {
    if (!confirm("Hapus metode pembayaran ini?")) return;
    setDeletingId(pmId);
    setStatusMsg(null);

    const res = await deletePaymentMethod(pmId);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: "Metode pembayaran berhasil dihapus.",
      });
      router.refresh();
    }
    setDeletingId(null);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  // Group all payment methods across memberships
  // Flatten unique by (type, label, value) for display
  const allMethods: { pm: PaymentMethod; groupName: string }[] = [];
  memberships.forEach((m) => {
    m.paymentMethods.forEach((pm) => {
      allMethods.push({ pm, groupName: m.group.name });
    });
  });

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#121212] p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Top Navbar */}
        <div className="flex items-center justify-between pb-4 border-b-[3px] border-[#121212]">
          <div className="flex items-center gap-3">
            <Link
              href="/groups"
              className="btn-brutal bg-[#f0edec] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider"
            >
              ⬅️ Daftar Grup
            </Link>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              ⚙️ Pengaturan Akun
            </h1>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            🚪 Keluar
          </button>
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

        {/* Profile Card */}
        <div className="bg-white border-brutal shadow-brutal p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            👤 Profil Pengguna
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FFE600] border-brutal flex items-center justify-center font-display text-2xl font-black">
              {(user.name || user.email || "U")[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="font-display text-base font-bold">
                {user.name || "Pengguna Patungan"}
              </h3>
              <p className="font-sans text-xs text-[#4b4731]">{user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="bg-[#f0edec] border-brutal-sm px-2 py-0.5 font-display text-[10px] font-bold uppercase">
                  {memberships.length} Grup Aktif
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods Section (US-F6, FR-20) */}
        <div className="bg-white border-brutal shadow-brutal">
          <div className="p-5 bg-[#00D2FF] border-b-[3px] border-[#121212]">
            <h2 className="font-display text-lg font-bold text-[#121212]">
              💳 Metode Pembayaran (Rekening / E-Wallet)
            </h2>
            <p className="font-sans text-xs text-[#121212] mt-0.5">
              Simpan nomor rekening atau e-wallet agar teman di grup mudah mentransfer saat pelunasan. Hanya terlihat oleh sesama anggota grup.
            </p>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Add Payment Method Form */}
            <form onSubmit={handleAdd} className="bg-[#FFFDF5] border-brutal-sm p-4 space-y-4">
              <span className="font-display text-xs font-bold uppercase tracking-wider block">
                ➕ Tambah Metode Pembayaran Baru
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Jenis Pembayaran
                  </label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(
                        e.target.value as
                          | "gopay"
                          | "shopeepay"
                          | "dana"
                          | "ovo"
                          | "bank"
                          | "qris"
                          | "other",
                      )
                    }
                    className="w-full border-brutal-sm p-2 text-sm bg-white font-sans"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Label / Bank
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BCA a.n. Budi"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full border-brutal-sm p-2 text-sm font-sans"
                    maxLength={100}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Nomor Rekening / Nomor HP / ID
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1234567890 / 08123456789"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full border-brutal-sm p-2 text-sm font-sans"
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Terapkan Ke
                  </label>
                  <select
                    value={targetMemberId}
                    onChange={(e) => setTargetMemberId(e.target.value)}
                    className="w-full border-brutal-sm p-2 text-sm bg-white font-sans"
                  >
                    <option value="">🌐 Semua Grup Saya</option>
                    {memberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        Grup: {m.group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brutal bg-[#00F090] text-[#121212] px-4 py-2 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {loading ? "Menyimpan..." : "Simpan Metode"}
                </button>
              </div>
            </form>

            {/* List of Existing Payment Methods */}
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider mb-3">
                Daftar Metode Pembayaran Tersimpan ({allMethods.length})
              </h3>

              {allMethods.length === 0 ? (
                <div className="bg-[#f0edec] border-brutal-sm p-6 text-center text-xs text-[#7c775f] font-sans">
                  Belum ada metode pembayaran yang disimpan. Tambahkan rekening atau e-wallet di atas agar teman dapat mentransfer langsung ke rekeningmu.
                </div>
              ) : (
                <div className="divide-y-[2px] divide-[#121212] border-brutal-sm bg-[#FFFDF5]">
                  {allMethods.map(({ pm, groupName }) => (
                    <div
                      key={pm.id}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {TYPE_OPTIONS.find((t) => t.value === pm.type)?.emoji || "💳"}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-bold">
                              {pm.label}
                            </span>
                            <span className="bg-[#e2dedd] px-1.5 py-0.5 text-[10px] font-mono rounded">
                              {groupName}
                            </span>
                          </div>
                          <code className="font-mono text-xs text-[#4b4731] block mt-0.5">
                            {pm.value}
                          </code>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(pm.id)}
                        disabled={deletingId === pm.id}
                        className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-2.5 py-1 font-display text-[10px] font-bold uppercase cursor-pointer"
                      >
                        {deletingId === pm.id ? "..." : "Hapus"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
