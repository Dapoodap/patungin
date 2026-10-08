"use client";

import { useState, useEffect, useTransition } from "react";
import { formatRecap } from "@/lib/share/format-recap";
import {
  createShareLink,
  revokeShareLink,
  getGroupShareLinks,
} from "@/app/actions/share-link";

interface ShareRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  totalExpenses: number;
  members: Array<{ id: string; displayName: string }>;
  balances: Record<string, number>;
  transfers: Array<{ from: string; to: string; amount: number }>;
  isOwner?: boolean;
}

interface ShareLinkItem {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  showDetails: boolean;
  viewCount: number;
  createdAt: string;
  isExpired: boolean;
  isActive: boolean;
}

export function ShareRecapModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  totalExpenses,
  members,
  balances,
  transfers,
  isOwner = false,
}: ShareRecapModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "image" | "link">("text");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Link Tab state
  const [isPending, startTransition] = useTransition();
  const [showDetailsOption, setShowDetailsOption] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdExpiresAt, setCreatedExpiresAt] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkList, setLinkList] = useState<ShareLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Load existing links when link tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "link") {
      setLoadingLinks(true);
      getGroupShareLinks(groupId)
        .then((data) => setLinkList(data))
        .catch((e) => console.error("Failed to load share links:", e))
        .finally(() => setLoadingLinks(false));
    }
  }, [isOpen, activeTab, groupId]);

  if (!isOpen) return null;

  const recapText = formatRecap({
    groupName,
    totalExpenses,
    members: members.map((m) => ({ id: m.id, name: m.displayName })),
    balances,
    transfers: transfers.map((t) => ({
      fromId: t.from,
      toId: t.to,
      amount: t.amount,
    })),
  });

  const ogImageUrl = `/api/og/recap/${groupId}`;

  // Handle WhatsApp / Web Share Text
  const handleShareText = async () => {
    setIsSharing(true);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Rekap Patungan: ${groupName}`,
          text: recapText,
        });
        setIsSharing(false);
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Web share error, falling back to wa.me:", err);
        }
      }
    }

    // Fallback: copy text and open wa.me
    try {
      await navigator.clipboard.writeText(recapText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(recapText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setIsSharing(false);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(recapText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert("Gagal menyalin teks ke clipboard.");
    }
  };

  // Handle Download Image
  const handleDownloadImage = async () => {
    try {
      const res = await fetch(ogImageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-${groupName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Gagal mengunduh gambar:", err);
      alert("Gagal mengunduh gambar rekap.");
    }
  };

  // Handle Share Image via Web Share API
  const handleShareImage = async () => {
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      navigator.canShare
    ) {
      try {
        const res = await fetch(ogImageUrl);
        const blob = await res.blob();
        const file = new File(
          [blob],
          `rekap-${groupName.toLowerCase().replace(/\s+/g, "-")}.png`,
          { type: "image/png" },
        );

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Rekap Patungan: ${groupName}`,
            files: [file],
          });
          return;
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Gagal berbagi gambar:", err);
        }
      }
    }

    handleDownloadImage();
  };

  // Handle Create Public Share Link
  const handleCreateShareLink = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("showDetails", showDetailsOption ? "true" : "false");
      fd.set("expiresInDays", expiresInDays.toString());

      const res = await createShareLink(fd);
      if (res.ok) {
        const fullUrl = `${window.location.origin}${res.data.url}`;
        setCreatedUrl(fullUrl);
        setCreatedExpiresAt(res.data.expiresAt);
        // Refresh list
        getGroupShareLinks(groupId).then((data) => setLinkList(data));
      } else {
        alert(res.error.message);
      }
    });
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      alert("Gagal menyalin tautan.");
    }
  };

  const handleRevoke = (linkId: string) => {
    if (!confirm("Cabut tautan baca-saja ini? Pengunjung tidak akan bisa mengakses lagi.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("shareLinkId", linkId);
      const res = await revokeShareLink(fd);
      if (res.ok) {
        getGroupShareLinks(groupId).then((data) => setLinkList(data));
      } else {
        alert(res.error.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FFFDF5] border-brutal shadow-brutal max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-[#FFE600] border-b-[3px] border-[#121212] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📢</span>
            <span className="font-display font-extrabold text-sm sm:text-base uppercase tracking-wider text-[#121212]">
              Bagikan Rekap Patungan
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white border-brutal-sm flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-[#FF66C4] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b-[3px] border-[#121212] bg-[#f0edec]">
          <button
            onClick={() => setActiveTab("text")}
            className={`flex-1 py-3 px-3 font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "text"
                ? "bg-[#FFFDF5] text-[#121212] border-b-0 border-r-[3px] border-[#121212]"
                : "text-[#7c775f] hover:bg-white/50 border-r-[3px] border-[#121212]"
            }`}
          >
            <span>💬</span> Teks WA
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`flex-1 py-3 px-3 font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "image"
                ? "bg-[#FFFDF5] text-[#121212] border-b-0 border-r-[3px] border-[#121212]"
                : "text-[#7c775f] hover:bg-white/50 border-r-[3px] border-[#121212]"
            }`}
          >
            <span>🖼️</span> Kartu Gambar
          </button>
          <button
            onClick={() => setActiveTab("link")}
            className={`flex-1 py-3 px-3 font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "link"
                ? "bg-[#FFFDF5] text-[#121212] border-b-0"
                : "text-[#7c775f] hover:bg-white/50"
            }`}
          >
            <span>🔗</span> Tautan Web
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "text" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs text-[#7c775f] font-semibold">
                  Pratinjau pesan siap kirim:
                </span>
                {copySuccess && (
                  <span className="bg-[#00F090] text-[#121212] font-display text-[11px] font-bold px-2 py-0.5 border-brutal-sm">
                    ✓ Teks Berhasil Disalin!
                  </span>
                )}
              </div>

              <div className="relative">
                <pre className="w-full h-56 p-3.5 bg-white border-brutal-sm font-mono text-xs text-[#121212] overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                  {recapText}
                </pre>
              </div>

              <p className="font-sans text-[11px] text-[#7c775f]">
                💡 Tombol <b>Bagikan ke WhatsApp</b> akan membuka menu share
                peramban atau langsung membuka aplikasi WhatsApp dengan pesan
                terisi otomatis.
              </p>
            </div>
          )}

          {activeTab === "image" && (
            <div className="space-y-4">
              <span className="font-sans text-xs text-[#7c775f] font-semibold block">
                Pratinjau kartu rekap server-side (ImageResponse):
              </span>

              <div className="border-brutal-sm overflow-hidden bg-white shadow-brutal-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogImageUrl}
                  alt={`Rekap ${groupName}`}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>

              <p className="font-sans text-[11px] text-[#7c775f]">
                🎨 Kartu gambar dibuat dinamis oleh server dalam resolusi tajam
                1200×630, siap untuk disebarkan ke WhatsApp Story atau grup chat.
              </p>
            </div>
          )}

          {activeTab === "link" && (
            <div className="space-y-5">
              <div className="bg-[#FFFDF5] border-2 border-black p-3.5 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🌐</span>
                  <span className="font-display font-extrabold text-xs uppercase text-black">
                    Tautan Baca-Saja Publik (Tanpa Login)
                  </span>
                </div>
                <p className="text-xs text-neutral-600">
                  Teman dapat melihat rekap dan transfer langsung dari peramban tanpa perlu masuk akun. Data pribadi seperti rekening, email, dan user ID dijamin disembunyikan.
                </p>
              </div>

              {/* Form Create (Owner only) */}
              {isOwner ? (
                <div className="bg-white border-2 border-black p-4 rounded-xl space-y-3">
                  <span className="font-black text-xs uppercase tracking-wide block text-neutral-800">
                    Buat Tautan Publik Baru
                  </span>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDetailsOption}
                      onChange={(e) => setShowDetailsOption(e.target.checked)}
                      className="w-4 h-4 border-2 border-black rounded accent-black"
                    />
                    <span>Tampilkan Rincian Transaksi Pengeluaran</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-neutral-700">
                      Masa Berlaku:
                    </label>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="text-xs font-bold border-2 border-black bg-[#FFFDF5] p-1.5 rounded-lg"
                    >
                      <option value={7}>7 Hari</option>
                      <option value={14}>14 Hari</option>
                      <option value={30}>30 Hari (Standar)</option>
                      <option value={60}>60 Hari</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleCreateShareLink}
                    className="w-full py-2 bg-[#FFE58F] border-2 border-black font-black text-xs uppercase rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Memproses..." : "⚡ Buat Tautan Sekarang"}
                  </button>

                  {/* Tautan Baru yang Dibuat */}
                  {createdUrl && (
                    <div className="mt-3 p-3 bg-emerald-50 border-2 border-emerald-600 rounded-xl space-y-2">
                      <span className="text-xs font-black text-emerald-800 block">
                        ✓ Tautan Berhasil Dibuat:
                      </span>
                      <input
                        type="text"
                        readOnly
                        value={createdUrl}
                        className="w-full text-xs font-mono bg-white border border-black p-2 rounded select-all"
                      />
                      <div className="flex items-center justify-between text-[11px] text-neutral-600">
                        <span>
                          Berlaku hingga:{" "}
                          {createdExpiresAt
                            ? new Date(createdExpiresAt).toLocaleDateString("id-ID")
                            : "30 hari"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(createdUrl)}
                            className="px-2.5 py-1 bg-white border border-black rounded font-bold text-xs hover:bg-neutral-100 cursor-pointer"
                          >
                            {linkCopied ? "✓ Disalin" : "Salin"}
                          </button>
                          <a
                            href={createdUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-emerald-600 text-white border border-black rounded font-bold text-xs hover:bg-emerald-700"
                          >
                            Buka &rarr;
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-xl text-xs text-neutral-600">
                  ℹ️ Hanya pembuat (owner) grup yang dapat menerbitkan atau mencabut tautan baca-saja publik.
                </div>
              )}

              {/* Riwayat Tautan */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-black uppercase text-neutral-500 block">
                  Daftar Tautan Aktif ({linkList.filter((l) => l.isActive).length})
                </span>

                {loadingLinks ? (
                  <p className="text-xs text-neutral-400">Memuat tautan...</p>
                ) : linkList.length === 0 ? (
                  <p className="text-xs text-neutral-500">Belum ada tautan publik yang dibuat.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {linkList.map((link) => (
                      <div
                        key={link.id}
                        className="p-2.5 bg-white border-2 border-black rounded-lg flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                link.isActive ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            <span className="font-bold">
                              {link.isActive
                                ? "Aktif"
                                : link.revokedAt
                                ? "Dicabut"
                                : "Kedaluwarsa"}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              &bull; {link.viewCount}x dilihat
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-500 block">
                            Hingga: {new Date(link.expiresAt).toLocaleDateString("id-ID")}
                            {link.showDetails && " &bull; Rincian aktif"}
                          </span>
                        </div>

                        {isOwner && link.isActive && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRevoke(link.id)}
                            className="px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-black rounded font-bold text-[11px] text-rose-800 cursor-pointer"
                          >
                            Cabut
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-[#f0edec] border-t-[3px] border-[#121212] flex flex-wrap items-center justify-end gap-3">
          {activeTab === "text" && (
            <>
              <button
                type="button"
                onClick={handleCopyText}
                className="btn-brutal bg-white px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer"
              >
                {copySuccess ? "✓ Tersalin" : "📋 Salin Teks"}
              </button>
              <button
                type="button"
                disabled={isSharing}
                onClick={handleShareText}
                className="btn-brutal bg-[#25D366] text-white px-5 py-2 font-display text-xs font-bold uppercase cursor-pointer shadow-brutal flex items-center gap-2 hover:bg-[#20ba59]"
              >
                <span>🚀</span>
                <span>Bagikan ke WhatsApp</span>
              </button>
            </>
          )}

          {activeTab === "image" && (
            <>
              <button
                type="button"
                onClick={handleDownloadImage}
                className="btn-brutal bg-white px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer flex items-center gap-1.5"
              >
                <span>💾</span> Unduh Gambar (.png)
              </button>
              <button
                type="button"
                onClick={handleShareImage}
                className="btn-brutal bg-[#FFE600] text-[#121212] px-5 py-2 font-display text-xs font-bold uppercase cursor-pointer shadow-brutal flex items-center gap-2"
              >
                <span>📤</span> Bagikan Gambar
              </button>
            </>
          )}

          {activeTab === "link" && (
            <button
              type="button"
              onClick={onClose}
              className="btn-brutal bg-white px-5 py-2 font-display text-xs font-bold uppercase cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
