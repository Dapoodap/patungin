"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInvite,
  revokeInvite,
  addPlaceholderMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
} from "@/app/actions/group";

interface Member {
  id: string;
  userId: string | null;
  displayName: string;
  role: "owner" | "member";
  joinedAt: Date;
}

interface Invite {
  id: string;
  tokenHash: string;
  role: "owner" | "member";
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
}

export function MemberManagementClient({
  groupId,
  currentMember,
  membersList,
  invitesList,
}: {
  groupId: string;
  currentMember: Member;
  membersList: Member[];
  invitesList: Invite[];
}) {
  const router = useRouter();
  const isOwner = currentMember.role === "owner";

  // State
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [placeholderName, setPlaceholderName] = useState("");

  const handleCreateInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    setCreatedInviteLink(null);

    const formData = new FormData(e.currentTarget);
    formData.set("groupId", groupId);

    const res = await createInvite(formData);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setCreatedInviteLink(res.data.link);
      setStatusMsg({
        type: "success",
        text: "Link undangan berhasil dibuat! Salin sekarang karena token hanya tampil sekali.",
      });
      router.refresh();
    }
    setLoading(false);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Cabut link undangan ini agar tidak bisa dipakai lagi?")) return;
    setLoading(true);
    const res = await revokeInvite(groupId, inviteId);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({ type: "success", text: "Link undangan berhasil dicabut." });
      router.refresh();
    }
    setLoading(false);
  };

  const handleAddPlaceholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeholderName.trim()) return;
    setLoading(true);

    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("displayName", placeholderName.trim());

    const res = await addPlaceholderMember(formData);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({ type: "success", text: `Anggota ${placeholderName} berhasil ditambahkan.` });
      setPlaceholderName("");
      router.refresh();
    }
    setLoading(false);
  };

  const handleToggleRole = async (targetMember: Member) => {
    const nextRole = targetMember.role === "owner" ? "member" : "owner";
    if (
      !confirm(
        `Ubah peran ${targetMember.displayName} menjadi ${nextRole.toUpperCase()}?`,
      )
    )
      return;

    setLoading(true);
    const res = await updateMemberRole(groupId, targetMember.id, nextRole);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: `Peran ${targetMember.displayName} berhasil diubah ke ${nextRole}.`,
      });
      router.refresh();
    }
    setLoading(false);
  };

  const handleRemoveMember = async (targetMember: Member) => {
    if (!confirm(`Keluarkan ${targetMember.displayName} dari grup ini?`)) return;
    setLoading(true);
    const res = await removeMember(groupId, targetMember.id);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
    } else {
      setStatusMsg({
        type: "success",
        text: `${targetMember.displayName} berhasil dikeluarkan dari grup.`,
      });
      router.refresh();
    }
    setLoading(false);
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Apakah Anda yakin ingin keluar dari grup ini?")) return;
    setLoading(true);
    const res = await leaveGroup(groupId);
    if (!res.ok) {
      setStatusMsg({ type: "error", text: res.error.message });
      setLoading(false);
    } else {
      router.push("/groups");
      router.refresh();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-8">
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

      {/* Generated Invite Modal / Card */}
      {createdInviteLink && (
        <div className="bg-[#FFE600] border-brutal shadow-brutal p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🎉</span>
            <h3 className="font-display text-lg font-bold">
              Link Undangan Baru Siap Dibagikan!
            </h3>
          </div>
          <p className="font-sans text-xs text-[#121212] mb-3">
            Sesuai aturan keamanan, token ini hanya ditampilkan <strong>sekali ini saja</strong>. Salin dan kirimkan ke temanmu!
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdInviteLink}
              className="bg-white border-brutal-sm p-2.5 font-mono text-xs w-full select-all"
            />
            <button
              onClick={() => copyToClipboard(createdInviteLink)}
              type="button"
              className="btn-brutal bg-white text-[#121212] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer"
            >
              {copied ? "Tersalin! ✅" : "Salin Link"}
            </button>
          </div>
        </div>
      )}

      {/* Owner Section: Buat Link Undangan & Tambah Placeholder */}
      {isOwner && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Buat Undangan */}
          <div className="bg-white border-brutal shadow-brutal p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-[#00D2FF] border-brutal-sm flex items-center justify-center font-display text-xs font-bold">
                🔗
              </span>
              <h3 className="font-display text-lg font-bold">Buat Link Undangan</h3>
            </div>
            <p className="font-sans text-xs text-[#4b4731] mb-4">
              Link menggunakan token acak 32-byte berbatas waktu dan kuota pemakaian atomik.
            </p>

            <form onSubmit={handleCreateInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-display text-[11px] font-bold uppercase mb-1">
                    Batas Kuota
                  </label>
                  <input
                    name="maxUses"
                    type="number"
                    defaultValue={5}
                    min={1}
                    max={50}
                    className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-display text-[11px] font-bold uppercase mb-1">
                    Masa Berlaku
                  </label>
                  <select
                    name="expiresInDays"
                    defaultValue={7}
                    className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
                  >
                    <option value={1}>1 Hari</option>
                    <option value={3}>3 Hari</option>
                    <option value={7}>7 Hari (Default)</option>
                    <option value={14}>14 Hari</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-display text-[11px] font-bold uppercase mb-1">
                  Klaim Profil Anggota (Opsional)
                </label>
                <select
                  name="claimMemberId"
                  className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
                >
                  <option value="">-- Buat Anggota Baru --</option>
                  {membersList
                    .filter((m) => !m.userId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Klaim: {m.displayName} (tanpa akun)
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-brutal w-full bg-[#00D2FF] text-[#121212] py-2.5 px-3 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Buat Link Undangan
              </button>
            </form>
          </div>

          {/* Card: Tambah Anggota Placeholder */}
          <div className="bg-white border-brutal shadow-brutal p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-[#FFE600] border-brutal-sm flex items-center justify-center font-display text-xs font-bold">
                👤
              </span>
              <h3 className="font-display text-lg font-bold">
                Tambah Anggota Sementara
              </h3>
            </div>
            <p className="font-sans text-xs text-[#4b4731] mb-4">
              Catat nama teman sebelum mereka membuat akun agar pengeluaran tetap bisa dibagi.
            </p>

            <form onSubmit={handleAddPlaceholder} className="space-y-3">
              <div>
                <label className="block font-display text-[11px] font-bold uppercase mb-1">
                  Nama Panggilan Teman
                </label>
                <input
                  type="text"
                  required
                  value={placeholderName}
                  onChange={(e) => setPlaceholderName(e.target.value)}
                  placeholder="Mis. Rakya, Kiki, Budi"
                  className="w-full bg-[#f6f3f2] border-brutal-sm p-2 font-sans text-xs outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-brutal w-full bg-[#FFE600] text-[#121212] py-2.5 px-3 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Tambah Nama ke Grup
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Daftar Anggota Grup */}
      <div className="bg-white border-brutal shadow-brutal p-6">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center justify-between">
          <span>Daftar Anggota Grup ({membersList.length})</span>
          {!isOwner && (
            <button
              onClick={handleLeaveGroup}
              disabled={loading}
              type="button"
              className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-3 py-1 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Keluar Dari Grup
            </button>
          )}
        </h3>

        <div className="divide-y-2 divide-[#f0edec]">
          {membersList.map((m) => {
            const isMe = m.id === currentMember.id;
            const hasAccount = !!m.userId;

            return (
              <div
                key={m.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
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
                      <span className="font-display text-sm font-bold text-[#121212]">
                        {m.displayName}
                      </span>
                      {isMe && (
                        <span className="bg-[#f0edec] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold">
                          KAMU
                        </span>
                      )}
                      {!hasAccount && (
                        <span className="bg-[#ffd8e9] text-[#890063] px-1.5 py-0.5 border-brutal-sm font-display text-[10px] font-bold">
                          BELUM TERHUBUNG
                        </span>
                      )}
                    </div>
                    <span className="font-sans text-xs text-[#7c775f]">
                      Peran: <strong className="uppercase">{m.role}</strong>
                    </span>
                  </div>
                </div>

                {isOwner && !isMe && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleRole(m)}
                      disabled={loading}
                      type="button"
                      className="btn-brutal bg-[#f0edec] px-2.5 py-1 font-display text-[11px] font-bold uppercase"
                    >
                      {m.role === "owner" ? "Jadikan Member" : "Jadikan Owner"}
                    </button>
                    <button
                      onClick={() => handleRemoveMember(m)}
                      disabled={loading}
                      type="button"
                      className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-2.5 py-1 font-display text-[11px] font-bold uppercase"
                    >
                      Keluarkan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daftar Undangan Aktif (Hanya Owner) */}
      {isOwner && invitesList.length > 0 && (
        <div className="bg-white border-brutal shadow-brutal p-6">
          <h3 className="font-display text-lg font-bold mb-4">
            Link Undangan yang Pernah Dibuat ({invitesList.length})
          </h3>
          <div className="divide-y-2 divide-[#f0edec]">
            {invitesList.map((inv) => (
              <div
                key={inv.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 font-display text-xs font-bold">
                    <span>Kuota: {inv.usedCount} / {inv.maxUses} terpakai</span>
                    <span className="bg-[#f0edec] px-1.5 py-0.5 border-brutal-sm font-mono text-[10px]">
                      hash: {inv.tokenHash.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="font-sans text-xs text-[#7c775f]">
                    Kedaluwarsa: {new Date(inv.expiresAt).toLocaleDateString("id-ID")}
                  </span>
                </div>

                <button
                  onClick={() => handleRevokeInvite(inv.id)}
                  disabled={loading}
                  type="button"
                  className="btn-brutal bg-[#ffdad6] text-[#ba1a1a] px-2.5 py-1 font-display text-[11px] font-bold uppercase self-end sm:self-auto cursor-pointer"
                >
                  Cabut Link
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
