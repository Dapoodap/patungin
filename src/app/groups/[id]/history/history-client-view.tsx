"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/money";

interface AuditLogItem {
  id: string;
  groupId: string;
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
}

const ACTION_MAP: Record<
  string,
  { label: string; bg: string; text: string; icon: string; category: string }
> = {
  "group.create": {
    label: "Grup Dibuat",
    bg: "bg-[#00F090]",
    text: "text-[#121212]",
    icon: "🏠",
    category: "group",
  },
  "expense.create": {
    label: "Tambah Pengeluaran",
    bg: "bg-[#FFE600]",
    text: "text-[#121212]",
    icon: "💸",
    category: "expense",
  },
  "expense.update": {
    label: "Ubah Pengeluaran",
    bg: "bg-[#00D2FF]",
    text: "text-[#121212]",
    icon: "✏️",
    category: "expense",
  },
  "expense.delete": {
    label: "Hapus Pengeluaran",
    bg: "bg-[#ffdad6]",
    text: "text-[#ba1a1a]",
    icon: "🗑️",
    category: "expense",
  },
  "settlement.create": {
    label: "Tandai Transfer",
    bg: "bg-[#ffd8e9]",
    text: "text-[#121212]",
    icon: "⏳",
    category: "settlement",
  },
  "settlement.confirm": {
    label: "Konfirmasi Pelunasan",
    bg: "bg-[#00F090]",
    text: "text-[#121212]",
    icon: "✅",
    category: "settlement",
  },
  "settlement.reject": {
    label: "Tolak Pelunasan",
    bg: "bg-[#ffdad6]",
    text: "text-[#ba1a1a]",
    icon: "❌",
    category: "settlement",
  },
  "settlement.direct": {
    label: "Pelunasan Langsung (Owner)",
    bg: "bg-[#00F090]",
    text: "text-[#121212]",
    icon: "⚡",
    category: "settlement",
  },
};

export function HistoryClientView({
  groupId,
  groupName,
  logs,
}: {
  groupId: string;
  groupName: string;
  logs: AuditLogItem[];
}) {
  const [filter, setFilter] = useState<string>("all");

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    const cat = ACTION_MAP[log.action]?.category || "other";
    return cat === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b-[3px] border-[#121212] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              📜 Riwayat Perubahan
            </h2>
            <span className="bg-[#FFE600] px-2 py-0.5 border-brutal-sm font-display text-[11px] font-bold uppercase">
              Khusus Owner
            </span>
          </div>
          <p className="font-sans text-sm text-[#4b4731] mt-1">
            Audit log lengkap segala perubahan pengeluaran, pelunasan, dan data di grup &quot;{groupName}&quot;.
          </p>
        </div>

        <Link
          href={`/groups/${groupId}`}
          className="btn-brutal bg-[#f0edec] px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider self-start sm:self-auto"
        >
          ⬅️ Kembali ke Rekap
        </Link>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider border-brutal-sm cursor-pointer ${
            filter === "all"
              ? "bg-[#121212] text-white"
              : "bg-white hover:bg-[#FFE600]"
          }`}
        >
          Semua ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("expense")}
          className={`px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider border-brutal-sm cursor-pointer ${
            filter === "expense"
              ? "bg-[#121212] text-white"
              : "bg-white hover:bg-[#FFE600]"
          }`}
        >
          💸 Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => setFilter("settlement")}
          className={`px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider border-brutal-sm cursor-pointer ${
            filter === "settlement"
              ? "bg-[#121212] text-white"
              : "bg-white hover:bg-[#FFE600]"
          }`}
        >
          🤝 Pelunasan
        </button>
        <button
          type="button"
          onClick={() => setFilter("group")}
          className={`px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider border-brutal-sm cursor-pointer ${
            filter === "group"
              ? "bg-[#121212] text-white"
              : "bg-white hover:bg-[#FFE600]"
          }`}
        >
          🏠 Grup
        </button>
      </div>

      {/* Audit Log Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border-brutal shadow-brutal p-8 text-center">
          <p className="font-display text-base font-bold text-[#4b4731]">
            Tidak ada riwayat untuk filter ini.
          </p>
        </div>
      ) : (
        <div className="bg-white border-brutal shadow-brutal divide-y-[3px] divide-[#121212]">
          {filteredLogs.map((log) => {
            const actionInfo = ACTION_MAP[log.action] || {
              label: log.action,
              bg: "bg-[#f0edec]",
              text: "text-[#121212]",
              icon: "📌",
            };
            const metaObj =
              log.meta && typeof log.meta === "object"
                ? (log.meta as Record<string, unknown>)
                : null;

            return (
              <div key={log.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 border-brutal-sm flex items-center justify-center text-xl shrink-0 bg-[#FFFDF5]">
                    {actionInfo.icon}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 border-brutal-sm font-display text-[11px] font-bold uppercase ${actionInfo.bg} ${actionInfo.text}`}
                      >
                        {actionInfo.label}
                      </span>
                      <span className="font-sans text-xs text-[#7c775f]">
                        oleh{" "}
                        <strong className="text-[#121212]">
                          {log.actorName || log.actorEmail || "Sistem"}
                        </strong>
                      </span>
                    </div>

                    {/* Metadata details */}
                    {metaObj && (
                      <div className="font-sans text-xs text-[#4b4731] mt-1 space-y-0.5">
                        {Boolean(metaObj.title) && (
                          <div>
                            Item: <strong className="text-[#121212]">&quot;{String(metaObj.title)}&quot;</strong>
                          </div>
                        )}
                        {metaObj.amount !== undefined && (
                          <div>
                            Nominal:{" "}
                            <strong className="text-[#121212]">
                              {formatRupiah(Number(metaObj.amount))}
                            </strong>
                          </div>
                        )}
                        {Boolean(metaObj.from && metaObj.to) && (
                          <div>
                            Dari: <strong>{String(metaObj.from)}</strong> ➔ Ke: <strong>{String(metaObj.to)}</strong>
                          </div>
                        )}
                        {Boolean(metaObj.category) && (
                          <div>
                            Kategori: <span className="capitalize">{String(metaObj.category)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <time className="font-mono text-xs text-[#7c775f] block">
                    {new Date(log.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                  <time className="font-mono text-[11px] text-[#7c775f] block">
                    {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
