import { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { shareLinkRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getPublicGroupShare, PublicGroupShareDTO } from "@/lib/share/public-dto";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicGroupShare(token);

  if (!data) {
    return {
      title: "Rekap Tidak Ditemukan - Patungin",
      robots: { index: false, follow: false, noarchive: true },
    };
  }

  return {
    title: `Rekap Patungan: ${data.name} - Patungin`,
    description: `Ringkasan pembagian beban dan penyelesaian utang-piutang grup ${data.name}. Total pengeluaran: Rp ${data.totalExpenses.toLocaleString("id-ID")}`,
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nocache: true,
    },
    other: {
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  };
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default async function PublicSharePage({ params }: Props) {
  const { token } = await params;

  // Rate Limiting by IP (30 req/min)
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  const rateCheck = await checkRateLimit(shareLinkRateLimiter, `share:${ip}`);
  if (!rateCheck.success) {
    return (
      <main className="min-h-screen bg-[#FFFDF5] text-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-black p-6 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="w-12 h-12 bg-red-100 border-2 border-black rounded-lg mx-auto flex items-center justify-center font-black text-xl mb-4">
            !
          </div>
          <h1 className="text-xl font-black mb-2">Terlalu Banyak Permintaan</h1>
          <p className="text-sm text-neutral-600 mb-6">
            Batas akses publik tercapai. Harap tunggu sebentar sebelum memuat ulang halaman ini.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-[#FFE58F] border-2 border-black font-bold rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  const shareData = await getPublicGroupShare(token);

  // Return 404 if not found, revoked, or expired
  if (!shareData) {
    notFound();
  }

  const isBalanced =
    shareData.members.reduce((acc, m) => acc + m.balance, 0) === 0;

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-black flex flex-col justify-between selection:bg-[#FFE58F]">
      {/* Top Warning Banner: Public Read-Only */}
      <header className="border-b-2 border-black bg-[#FFE58F] px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black inline-block animate-pulse"></span>
        <span>Mode Baca-Saja Publik — Tautan ini tidak memerlukan login dan berlaku hingga {formatDate(shareData.expiresAt)}</span>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-3xl mx-auto px-4 py-8 flex-1">
        {/* Header Grup */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="px-3 py-1 bg-neutral-100 border border-black rounded-full text-xs font-black uppercase tracking-wider">
              Rekap Patungan
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              Dibuat: {formatDate(shareData.createdAt)}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            {shareData.name}
          </h1>
          {shareData.description && (
            <p className="text-sm text-neutral-600 mb-4">{shareData.description}</p>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t-2 border-black">
            <div className="bg-[#FFFDF5] border-2 border-black rounded-xl p-4">
              <span className="text-xs font-bold text-neutral-500 block mb-1">
                TOTAL PENGELUARAN
              </span>
              <span className="text-2xl font-black text-black">
                {formatRupiah(shareData.totalExpenses)}
              </span>
            </div>

            <div className="bg-[#FFFDF5] border-2 border-black rounded-xl p-4">
              <span className="text-xs font-bold text-neutral-500 block mb-1">
                STATUS KESEIMBANGAN
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full border border-black ${
                    isBalanced ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <span className="text-base font-bold">
                  {isBalanced ? "Saldo Seimbang (Nol)" : "Perlu Penyesuaian"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Status Saldo Anggota */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2">
            <span className="w-4 h-4 bg-[#B7EB8F] border border-black inline-block"></span>
            Status Saldo Anggota ({shareData.members.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-neutral-100">
                  <th className="py-2.5 px-3 font-black">Nama</th>
                  <th className="py-2.5 px-3 font-black text-right">Dibayar</th>
                  <th className="py-2.5 px-3 font-black text-right">Tanggungan</th>
                  <th className="py-2.5 px-3 font-black text-right">Saldo Bersih</th>
                </tr>
              </thead>
              <tbody>
                {shareData.members.map((m) => (
                  <tr key={m.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50">
                    <td className="py-3 px-3 font-bold">{m.name}</td>
                    <td className="py-3 px-3 text-right text-neutral-600">
                      {formatRupiah(m.paid)}
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-600">
                      {formatRupiah(m.share)}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      {m.balance > 0 ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          +{formatRupiah(m.balance)}
                        </span>
                      ) : m.balance < 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                          {formatRupiah(m.balance)}
                        </span>
                      ) : (
                        <span className="text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                          Lunas
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Daftar Transfer Penyelesaian */}
        <section className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2">
            <span className="w-4 h-4 bg-[#FFE58F] border border-black inline-block"></span>
            Penyelesaian Transfer Minimum
          </h2>

          {shareData.transfers.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-center text-sm font-bold text-emerald-800">
              Semua utang-piutang telah seimbang. Tidak ada transfer yang diperlukan!
            </div>
          ) : (
            <div className="space-y-3">
              {shareData.transfers.map((t, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#FFFDF5] border-2 border-black rounded-xl gap-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-black text-rose-700">{t.fromName}</span>
                    <span className="text-neutral-400 font-bold">&rarr;</span>
                    <span className="font-black text-emerald-700">{t.toName}</span>
                  </div>
                  <div className="font-black text-base sm:text-right">
                    {formatRupiah(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Breakdown Kategori */}
        {shareData.categories.length > 0 && (
          <section className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <span className="w-4 h-4 bg-[#D3ADF7] border border-black inline-block"></span>
              Pengeluaran Berdasarkan Kategori
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shareData.categories.map((c) => (
                <div
                  key={c.name}
                  className="p-3 bg-neutral-50 border border-black rounded-xl"
                >
                  <span className="text-xs font-bold text-neutral-500 uppercase block truncate">
                    {c.name}
                  </span>
                  <span className="text-sm font-black text-black">
                    {formatRupiah(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rincian Transaksi Pengeluaran (Jika diaktifkan oleh owner) */}
        {shareData.showDetails && shareData.expenses && (
          <section className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <span className="w-4 h-4 bg-cyan-300 border border-black inline-block"></span>
              Rincian Pengeluaran ({shareData.expenses.length})
            </h2>

            {shareData.expenses.length === 0 ? (
              <p className="text-sm text-neutral-500">Belum ada pengeluaran yang dicatat.</p>
            ) : (
              <div className="space-y-4">
                {shareData.expenses.map((e) => (
                  <div
                    key={e.id}
                    className="p-4 border-2 border-black rounded-xl bg-[#FFFDF5] space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-base">{e.title}</h3>
                        <p className="text-xs text-neutral-500">
                          {formatDate(e.spentAt)} &bull; Dibayar oleh{" "}
                          <span className="font-bold text-black">{e.payerName}</span> &bull;{" "}
                          <span className="uppercase font-semibold">{e.category}</span>
                        </p>
                      </div>
                      <span className="text-base font-black">
                        {formatRupiah(e.amount)}
                      </span>
                    </div>

                    {/* Pembagian peserta */}
                    <div className="pt-2 border-t border-neutral-200">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase block mb-1">
                        Tanggungan Peserta:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {e.splits.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 bg-white border border-neutral-300 rounded font-medium"
                          >
                            {s.memberName}: {formatRupiah(s.shareAmount)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t-2 border-black bg-white py-6 px-4 text-center mt-12">
        <div className="max-w-md mx-auto space-y-3">
          <p className="text-sm font-bold text-neutral-700">
            Dibuat dengan <span className="font-black text-black">Patungin</span> — Catat & Bagi Beban Bersama Tanpa Ribet
          </p>
          <div>
            <Link
              href="/login"
              className="inline-block px-5 py-2.5 bg-[#FFE58F] border-2 border-black font-black text-sm rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            >
              Coba Patungin Gratis &rarr;
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
