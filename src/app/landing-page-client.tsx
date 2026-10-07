"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/money";

export function LandingPageClientView({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  // Interactive Simulator State
  const [totalBill, setTotalBill] = useState(600000);
  const [peopleCount, setPeopleCount] = useState(4);

  const perPerson = Math.round(
    totalBill / Math.max(1, peopleCount),
  );

  const primaryTarget = isLoggedIn ? "/groups" : "/login";

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#121212] selection:bg-[#FFE600] selection:text-[#121212]">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FFFDF5] border-b-[3px] border-[#121212]">
        <div className="h-16 sm:h-20 max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="Patungin Logo"
                className="w-8 h-8 sm:w-9 sm:h-9"
              />
              <span className="px-3 py-1 bg-[#FFE600] border-[3px] border-[#121212] shadow-[2px_2px_0px_#121212] font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-[#121212]">
                PATUNGIN
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            <a
              href="#fitur"
              className="px-3 py-1.5 border-[2px] border-transparent hover:border-[#121212] font-display text-xs font-bold uppercase hover:bg-white transition-all"
            >
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="px-3 py-1.5 border-[2px] border-transparent hover:border-[#121212] font-display text-xs font-bold uppercase hover:bg-white transition-all"
            >
              Cara Kerja
            </a>
            <a
              href="#simulasi-hitung"
              className="px-3 py-1.5 border-[2px] border-transparent hover:border-[#121212] font-display text-xs font-bold uppercase hover:bg-white transition-all"
            >
              Simulasi Hitung
            </a>
            <a
              href="#testimoni"
              className="px-3 py-1.5 border-[2px] border-transparent hover:border-[#121212] font-display text-xs font-bold uppercase hover:bg-white transition-all"
            >
              Testimoni
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <Link
                href="/groups"
                className="btn-brutal bg-[#00F090] px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#121212] flex items-center gap-1.5"
              >
                <span>Grup Saya</span>
                <span>➔</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="btn-brutal bg-white px-3 sm:px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#121212] hidden sm:inline-block"
                >
                  Masuk
                </Link>
                <Link
                  href="/login"
                  className="btn-brutal bg-[#FFE600] px-3 sm:px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#121212]"
                >
                  Mulai Sekarang
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 sm:pt-24 pb-16">
        {/* HERO SECTION */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Copywriting & CTA */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Top Pill Badge */}
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 bg-[#FFE600] border-[3px] border-[#121212] shadow-brutal-sm">
                <span className="text-base">⚡</span>
                <span className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#121212]">
                  NO #1 SPLIT BILL DI INDONESIA • ANTI RIBET
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#121212] leading-[1.1]">
                PATUNGAN TANPA DRAMA, <br />
                <span className="bg-[#FF66C4] px-2 py-0.5 border-[3px] border-[#121212] shadow-brutal-sm inline-block my-1 text-white">
                  GAK ADA CERITA
                </span>{" "}
                <br />
                NOMBOKIN DULUAN.
              </h1>

              {/* Subheadline */}
              <p className="font-sans text-base sm:text-lg text-[#4b4731] max-w-xl leading-relaxed">
                Bagi tagihan kosan, liburan bareng, atau makan di kafe secara instan.
                Hitung otomatis bobot porsi, ringkas transfer hutang ribet jadi{" "}
                <strong className="text-[#121212]">1 kali transfer/QRIS</strong>, dan
                tagih teman lewat WhatsApp tanpa rasa canggung.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
                <Link
                  href={primaryTarget}
                  className="btn-brutal bg-[#FFE600] px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-[#121212] flex items-center justify-center gap-2"
                >
                  <span>Mulai Patungan Sekarang</span>
                  <span className="text-lg">➔</span>
                </Link>
                <a
                  href="#simulasi-hitung"
                  className="btn-brutal bg-white px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-[#121212] flex items-center justify-center gap-2"
                >
                  <span>▶</span>
                  <span>Lihat Demo Interaktif</span>
                </a>
              </div>

              {/* Microcopy Trust Badges */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 font-display text-xs font-bold text-[#121212]">
                <span className="flex items-center gap-1.5">
                  <span className="text-[#00F090]">✔</span> 100% Gratis & Terbuka
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[#00F090]">✔</span> Tanpa Install App
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[#00F090]">✔</span> Langsung Buka via Browser HP
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Card Mockup */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-white border-brutal shadow-brutal-lg relative flex flex-col">
                {/* Header Bar */}
                <div className="bg-[#00D2FF] border-b-[3px] border-[#121212] px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-[#121212] border border-[#121212] inline-block"></span>
                    <span className="w-3 h-3 bg-[#FF66C4] border border-[#121212] inline-block"></span>
                    <span className="w-3 h-3 bg-[#FFE600] border border-[#121212] inline-block"></span>
                    <span className="font-display text-xs font-bold uppercase ml-1 tracking-wider text-[#121212]">
                      LIVE REKAP TAGIHAN
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 bg-[#121212] text-white font-display text-[10px] tracking-widest uppercase">
                    AKTIF
                  </span>
                </div>

                {/* Card Content Body */}
                <div className="p-4 sm:p-5 flex flex-col gap-3.5 bg-white">
                  {/* Info Acara & Nominal */}
                  <div className="flex items-start justify-between border-b-2 border-[#121212] pb-3">
                    <div>
                      <p className="font-display text-[11px] text-[#7c775f] uppercase font-bold">
                        Nama Acara
                      </p>
                      <h3 className="font-display text-base font-bold text-[#121212] uppercase">
                        All You Can Eat 6 Orang
                      </h3>
                      <span className="font-sans text-xs text-[#7c775f]">
                        Ditalangi oleh <strong className="text-[#121212]">Rian</strong> (Kasir PIK)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-[11px] uppercase text-[#7c775f] block font-bold">
                        Total Bill
                      </span>
                      <span className="font-display text-xl font-extrabold text-[#121212]">
                        Rp 1.350.000
                      </span>
                    </div>
                  </div>

                  {/* Algoritma Callout Box */}
                  <div className="bg-[#FFE600] border-[2px] border-[#121212] p-2.5 shadow-brutal-sm flex items-center gap-2.5">
                    <span className="text-2xl">⚡</span>
                    <div className="flex-1">
                      <span className="font-display text-xs font-bold uppercase block leading-tight text-[#121212]">
                        DIPOTONG ALGORITMA: DARI 15 TRANSFER JADI 2 TRANSFER AJA!
                      </span>
                    </div>
                  </div>

                  {/* List Pemisah Teman */}
                  <div className="space-y-2 pt-1">
                    {/* Item 1 */}
                    <div className="flex items-center justify-between p-2.5 bg-[#FFFDF5] border-[2px] border-[#121212]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 bg-[#FF66C4] border-[2px] border-[#121212] font-display text-xs flex items-center justify-center font-bold text-white">
                          AL
                        </span>
                        <div>
                          <span className="font-display text-xs font-bold uppercase block text-[#121212]">
                            Aldo (1.5x Porsi Wagyu)
                          </span>
                          <span className="font-sans text-[11px] text-[#7c775f]">
                            Sudah bayar via GoPay
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-display text-xs font-bold text-[#121212]">
                          Rp 337.500
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#00F090] border-brutal-sm font-display text-[9px] uppercase font-bold text-[#121212]">
                          LUNAS
                        </span>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-center justify-between p-2.5 bg-[#FFFDF5] border-[2px] border-[#121212]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 bg-[#00D2FF] border-[2px] border-[#121212] font-display text-xs flex items-center justify-center font-bold text-[#121212]">
                          DN
                        </span>
                        <div>
                          <span className="font-display text-xs font-bold uppercase block text-[#121212]">
                            Dina (0.5x Diet)
                          </span>
                          <span className="font-sans text-[11px] text-[#7c775f]">
                            Transfer ke Rian via QRIS
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-display text-xs font-bold text-[#121212]">
                          Rp 112.500
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#00F090] border-brutal-sm font-display text-[9px] uppercase font-bold text-[#121212]">
                          LUNAS
                        </span>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-center justify-between p-2.5 bg-[#FFFDF5] border-[2px] border-[#121212]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 bg-[#FFE600] border-[2px] border-[#121212] font-display text-xs flex items-center justify-center font-bold text-[#121212]">
                          FD
                        </span>
                        <div>
                          <span className="font-display text-xs font-bold uppercase block text-[#121212]">
                            Fadhil & 3 Lainnya
                          </span>
                          <span className="font-sans text-[11px] text-[#7c775f]">
                            Sisa pelunasan grup
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-display text-xs font-bold text-[#121212]">
                          Rp 900.000
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#FFE600] border-brutal-sm font-display text-[9px] uppercase font-bold text-[#121212]">
                          PROSES
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Action Quick Bar */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "Pesan rekap siap dikirim ke WhatsApp grup secara rapi!",
                        )
                      }
                      className="flex-1 py-2 px-3 bg-[#121212] text-white font-display text-xs uppercase font-bold flex items-center justify-center gap-1.5 btn-brutal cursor-pointer"
                    >
                      <span>💬</span>
                      <span>Kirim ke WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "Info pembayaran & rekening langsung disalin!",
                        )
                      }
                      className="py-2 px-3 bg-white border-brutal-sm font-display text-xs uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#FFE600]"
                    >
                      <span>📱</span>
                      <span>QRIS / Bank</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF & STATS STRIP */}
        <section className="w-full bg-[#FFE600] border-y-[3px] border-[#121212] py-6 shadow-[0_4px_0_#121212]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[#121212]">
              <div className="border-[2px] border-[#121212] bg-white p-3.5 shadow-brutal-sm">
                <span className="font-display text-2xl sm:text-3xl font-extrabold block leading-none">
                  Rp 4.8 M+
                </span>
                <span className="font-display text-[11px] sm:text-xs uppercase tracking-wide text-[#4b4731] mt-1.5 block font-bold">
                  Total Tagihan Terbagi
                </span>
              </div>
              <div className="border-[2px] border-[#121212] bg-white p-3.5 shadow-brutal-sm">
                <span className="font-display text-2xl sm:text-3xl font-extrabold block leading-none">
                  120.000+
                </span>
                <span className="font-display text-[11px] sm:text-xs uppercase tracking-wide text-[#4b4731] mt-1.5 block font-bold">
                  Grup Trip & Kos Aktif
                </span>
              </div>
              <div className="border-[2px] border-[#121212] bg-white p-3.5 shadow-brutal-sm">
                <span className="font-display text-2xl sm:text-3xl font-extrabold block leading-none">
                  0 Menit
                </span>
                <span className="font-display text-[11px] sm:text-xs uppercase tracking-wide text-[#4b4731] mt-1.5 block font-bold">
                  Drama Nagih di Chat
                </span>
              </div>
              <div className="border-[2px] border-[#121212] bg-white p-3.5 shadow-brutal-sm">
                <div className="flex items-center gap-1">
                  <span className="font-display text-2xl sm:text-3xl font-extrabold leading-none">
                    4.9/5
                  </span>
                  <span className="text-xl">⭐</span>
                </div>
                <span className="font-display text-[11px] sm:text-xs uppercase tracking-wide text-[#4b4731] mt-1.5 block font-bold">
                  Rating Mahasiswa & Gen Z
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* FITUR UTAMA / VALUE PROPOSITION SECTION */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20" id="fitur">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="px-2.5 py-1 bg-[#121212] text-white font-display text-xs uppercase tracking-wider font-bold">
                FITUR UNGGULAN
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-[#121212] mt-3 leading-tight">
                KENAPA GAK PAKE EXCEL AJA? <br />
                <span className="text-[#7c775f] font-normal">
                  KARENA INI JAUH LEBIH PINTAR.
                </span>
              </h2>
            </div>
            <p className="font-sans text-sm sm:text-base text-[#4b4731] max-w-sm">
              Dirancang khusus untuk memotong friksi sosial saat menagih uang ke teman satu geng.
            </p>
          </div>

          {/* Grid 4 Fitur Neo-Brutal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 (Kuning) */}
            <div className="bg-white border-brutal shadow-brutal flex flex-col justify-between">
              <div className="p-5 border-b-[3px] border-[#121212] bg-[#FFE600]">
                <div className="w-12 h-12 bg-white border-[3px] border-[#121212] flex items-center justify-center mb-3 shadow-brutal-sm text-2xl">
                  🔀
                </div>
                <span className="font-display text-xs uppercase tracking-widest text-[#121212] font-bold">
                  FITUR 01
                </span>
                <h3 className="font-display text-lg font-bold uppercase text-[#121212] mt-1">
                  Smart Debt Simplification
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                <p className="font-sans text-xs sm:text-sm text-[#121212] leading-relaxed">
                  Gak perlu semua orang transfer silang ke setiap orang. Algoritma canggih memangkas rantai hutang ke maksimal n-1 transfer paling efisien.
                </p>
                <div className="mt-4 pt-2 border-t-2 border-[#121212] flex items-center justify-between font-display text-xs">
                  <span className="font-bold uppercase text-[#121212]">Hemat Biaya Admin</span>
                  <span>✅</span>
                </div>
              </div>
            </div>

            {/* Card 2 (Biru Muda) */}
            <div className="bg-white border-brutal shadow-brutal flex flex-col justify-between">
              <div className="p-5 border-b-[3px] border-[#121212] bg-[#00D2FF]">
                <div className="w-12 h-12 bg-white border-[3px] border-[#121212] flex items-center justify-center mb-3 shadow-brutal-sm text-2xl">
                  🍕
                </div>
                <span className="font-display text-xs uppercase tracking-widest text-[#121212] font-bold">
                  FITUR 02
                </span>
                <h3 className="font-display text-lg font-bold uppercase text-[#121212] mt-1">
                  Bagi Porsi Adil (Custom Split)
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                <p className="font-sans text-xs sm:text-sm text-[#121212] leading-relaxed">
                  Yang cuma minum es teh gak perlu bayar wagyu! Atur porsi 0.5x, 1x, 2x porsi, atau input nominal dengan hitungan rupiah presisi tanpa sisa sen.
                </p>
                <div className="mt-4 pt-2 border-t-2 border-[#121212] flex items-center justify-between font-display text-xs">
                  <span className="font-bold uppercase text-[#121212]">100% Adil & Presisi</span>
                  <span>✅</span>
                </div>
              </div>
            </div>

            {/* Card 3 (Pink) */}
            <div className="bg-white border-brutal shadow-brutal flex flex-col justify-between">
              <div className="p-5 border-b-[3px] border-[#121212] bg-[#FF66C4]">
                <div className="w-12 h-12 bg-white border-[3px] border-[#121212] flex items-center justify-center mb-3 shadow-brutal-sm text-2xl">
                  💳
                </div>
                <span className="font-display text-xs uppercase tracking-widest text-white font-bold">
                  FITUR 03
                </span>
                <h3 className="font-display text-lg font-bold uppercase text-white mt-1">
                  QRIS & Rekening Bank
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                <p className="font-sans text-xs sm:text-sm text-[#121212] leading-relaxed">
                  Penerima cantumkan nomor rekening bank atau e-wallet (GoPay, DANA, ShopeePay, OVO). Teman tinggal salin nomor atau scan tanpa perlu bertanya.
                </p>
                <div className="mt-4 pt-2 border-t-2 border-[#121212] flex items-center justify-between font-display text-xs">
                  <span className="font-bold uppercase text-[#121212]">Salin 1-Klik</span>
                  <span>✅</span>
                </div>
              </div>
            </div>

            {/* Card 4 (Mint Hijau) */}
            <div className="bg-white border-brutal shadow-brutal flex flex-col justify-between">
              <div className="p-5 border-b-[3px] border-[#121212] bg-[#00F090]">
                <div className="w-12 h-12 bg-white border-[3px] border-[#121212] flex items-center justify-center mb-3 shadow-brutal-sm text-2xl">
                  📱
                </div>
                <span className="font-display text-xs uppercase tracking-widest text-[#121212] font-bold">
                  FITUR 04
                </span>
                <h3 className="font-display text-lg font-bold uppercase text-[#121212] mt-1">
                  Mobile-First Ergonomis
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                <p className="font-sans text-xs sm:text-sm text-[#121212] leading-relaxed">
                  Didesain khusus untuk jempol satu tangan saat kamu berdiri di depan kasir restoran yang ramai. Cepat, responsif, dan tombol min 44px ramah jempol.
                </p>
                <div className="mt-4 pt-2 border-t-2 border-[#121212] flex items-center justify-between font-display text-xs">
                  <span className="font-bold uppercase text-[#121212]">Cepat di Depan Kasir</span>
                  <span>✅</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE SIMULATION CALCULATOR */}
        <section className="w-full bg-[#F0EDEC] border-y-[3px] border-[#121212] py-16" id="simulasi-hitung">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="bg-white border-brutal shadow-brutal-lg p-6 sm:p-10">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b-[3px] border-[#121212] pb-6">
                <div>
                  <span className="px-2.5 py-0.5 bg-[#FFE600] border-[2px] border-[#121212] font-display text-xs uppercase font-bold text-[#121212]">
                    SIMULASI CEPAT
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-[#121212] mt-2">
                    Coba Hitung Split Bill Sekarang
                  </h2>
                  <p className="font-sans text-sm text-[#4b4731] mt-1">
                    Ubah angka pengeluaran dan jumlah orang untuk melihat kalkulasi instan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-[#121212] inline-block"></span>
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-[#121212]">
                    INTERAKTIF WIDGET
                  </span>
                </div>
              </div>

              {/* Simulator Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 items-center">
                {/* Input 1: Total Pengeluaran */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="sim-total-input" className="font-display text-xs uppercase font-bold text-[#121212]">
                    Total Tagihan (Rp)
                  </label>
                  <div className="flex items-center border-[3px] border-[#121212] bg-white">
                    <span className="px-3 py-2 bg-[#FFE600] font-display text-sm font-bold border-r-[3px] border-[#121212] text-[#121212]">
                      Rp
                    </span>
                    <input
                      id="sim-total-input"
                      type="number"
                      step="10000"
                      min="1000"
                      value={totalBill}
                      onChange={(e) =>
                        setTotalBill(Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className="w-full px-3 py-2 font-display text-lg font-bold text-[#121212] focus:outline-none focus:bg-[#FFFDE0]"
                    />
                  </div>
                  <span className="font-sans text-[11px] text-[#7c775f]">
                    Contoh: Bill ngopi bareng teman satu tim
                  </span>
                </div>

                {/* Input 2: Jumlah Orang */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="sim-people-input" className="font-display text-xs uppercase font-bold text-[#121212]">
                    Jumlah Orang
                  </label>
                  <div className="flex items-center border-[3px] border-[#121212] bg-white">
                    <input
                      id="sim-people-input"
                      type="number"
                      min="1"
                      max="100"
                      value={peopleCount}
                      onChange={(e) =>
                        setPeopleCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-full px-3 py-2 font-display text-lg font-bold text-[#121212] focus:outline-none focus:bg-[#FFFDE0]"
                    />
                    <span className="px-3 py-2 bg-[#F0EDEC] font-display text-xs font-bold border-l-[3px] border-[#121212] uppercase text-[#121212]">
                      Orang
                    </span>
                  </div>
                  <span className="font-sans text-[11px] text-[#7c775f]">
                    Termasuk kamu yang bayar di kasir
                  </span>
                </div>

                {/* Output Display Card */}
                <div className="bg-[#00D2FF] border-[3px] border-[#121212] p-5 shadow-brutal">
                  <span className="font-display text-xs uppercase font-bold text-[#121212] block">
                    Tagihan Tiap Orang
                  </span>
                  <div className="font-display text-2xl sm:text-3xl text-[#121212] font-black tracking-tight my-1">
                    {formatRupiah(perPerson)}
                  </div>
                  <p className="font-sans text-xs text-[#121212] font-medium leading-snug">
                    Hemat transfer bolak-balik dengan link pembayaran tunggal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BAGAIMANA CARA KERJANYA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20" id="cara-kerja">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="px-3 py-1 bg-[#FF66C4] text-white border-[2px] border-[#121212] font-display text-xs uppercase tracking-wide font-bold">
              SECEPAT KILAT
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-[#121212] mt-3">
              3 LANGKAH SIMPEL TANPA RIBET
            </h2>
            <p className="font-sans text-sm sm:text-base text-[#4b4731] mt-1">
              Buka dari HP siapa saja, langsung selesaikan tanpa perlu install aplikasi berat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white border-brutal shadow-brutal p-6 flex flex-col justify-between relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#FFE600] border-[3px] border-[#121212] font-display text-base flex items-center justify-center font-bold text-[#121212] shadow-brutal-sm">
                1
              </div>
              <div className="pt-2">
                <div className="h-28 bg-[#F0EDEC] border-[2px] border-[#121212] flex items-center justify-center mb-4 text-4xl">
                  🔗
                </div>
                <h3 className="font-display text-base font-bold uppercase text-[#121212] mb-1">
                  Buat Grup & Sebar Link
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#4b4731]">
                  Beri nama grup (misal: &quot;Trip Bromo 2025&quot; atau &quot;Kosan Sukabirus&quot;). Bagikan link undangan instan ke grup chat temanmu.
                </p>
              </div>
              <div className="mt-4 bg-[#F0EDEC] p-2 border-[2px] border-[#121212] font-display text-[11px] uppercase font-bold text-[#121212] flex items-center gap-1.5">
                <span>📢</span>
                <span>Siapa saja bisa akses tanpa download app</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border-brutal shadow-brutal p-6 flex flex-col justify-between relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#FF66C4] border-[3px] border-[#121212] font-display text-base flex items-center justify-center font-bold text-white shadow-brutal-sm">
                2
              </div>
              <div className="pt-2">
                <div className="h-28 bg-[#F0EDEC] border-[2px] border-[#121212] flex items-center justify-center mb-4 text-4xl">
                  🧾
                </div>
                <h3 className="font-display text-base font-bold uppercase text-[#121212] mb-1">
                  Catat Siapa yang Nombokin
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#4b4731]">
                  Setiap pengeluaran dicatat: siapa yang talangin, siapa saja yang ikut patungan, dan tentukan porsi bobot atau bagi rata.
                </p>
              </div>
              <div className="mt-4 bg-[#F0EDEC] p-2 border-[2px] border-[#121212] font-display text-[11px] uppercase font-bold text-[#121212] flex items-center gap-1.5">
                <span>🧮</span>
                <span>Otomatis dihitung real-time presisi</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border-brutal shadow-brutal p-6 flex flex-col justify-between relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#00F090] border-[3px] border-[#121212] font-display text-base flex items-center justify-center font-bold text-[#121212] shadow-brutal-sm">
                3
              </div>
              <div className="pt-2">
                <div className="h-28 bg-[#F0EDEC] border-[2px] border-[#121212] flex items-center justify-center mb-4 text-4xl">
                  🎉
                </div>
                <h3 className="font-display text-base font-bold uppercase text-[#121212] mb-1">
                  Transfer & Beres Lunas
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#4b4731]">
                  Cek ringkasan transfer paling hemat. Salin rekening atau scan QRIS teman, klik &apos;Sudah Transfer&apos;, dan konfirmasi!
                </p>
              </div>
              <div className="mt-4 bg-[#F0EDEC] p-2 border-[2px] border-[#121212] font-display text-[11px] uppercase font-bold text-[#121212] flex items-center gap-1.5">
                <span>🤝</span>
                <span>Gak ada utang menumpuk</span>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONI PENGGUNA */}
        <section className="w-full bg-[#FFFDF5] border-t-[3px] border-[#121212] py-16" id="testimoni">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-3">
              <div>
                <span className="px-2.5 py-1 bg-[#121212] text-white font-display text-xs uppercase font-bold">
                  SUARA WARGA PATUNGAN
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-[#121212] mt-2">
                  DIBUKTIKAN LANGSUNG DI LAPANGAN
                </h2>
              </div>
              <span className="font-display text-xs uppercase font-bold text-[#121212]">
                RATING KOMUNITAS 4.9 DARI 5.0
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Testimoni 1 */}
              <div className="bg-white border-brutal shadow-brutal p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-[#FFE600] border-[2px] border-[#121212] font-display text-sm flex items-center justify-center font-bold text-[#121212] shadow-brutal-sm">
                      DM
                    </span>
                    <div>
                      <h4 className="font-display text-base font-bold uppercase text-[#121212] leading-tight">
                        Dimas Prasetyo
                      </h4>
                      <span className="font-sans text-xs text-[#7c775f]">
                        Anak Kos Sukabirus, Bandung
                      </span>
                    </div>
                  </div>
                  <p className="font-sans text-sm sm:text-base text-[#121212] leading-relaxed italic">
                    &quot;Sejak pake Patungin buat urusan bayar WiFi dan galon kosan, gak pernah ada lagi cerita teman sekamar pura-pura lupa bayar. Tinggal send rekap WhatsApp, langsung pada bayar dalam hitungan menit!&quot;
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t-2 border-[#121212] flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#F0EDEC] border-brutal-sm font-display text-[10px] uppercase font-bold text-[#121212]">
                    Kategori: Kos & Kontrakan
                  </span>
                  <div className="flex text-amber-500 text-sm">
                    ⭐⭐⭐⭐⭐
                  </div>
                </div>
              </div>

              {/* Testimoni 2 */}
              <div className="bg-white border-brutal shadow-brutal p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-[#FF66C4] border-[2px] border-[#121212] font-display text-sm flex items-center justify-center font-bold text-white shadow-brutal-sm">
                      SL
                    </span>
                    <div>
                      <h4 className="font-display text-base font-bold uppercase text-[#121212] leading-tight">
                        Salsa Nabila
                      </h4>
                      <span className="font-sans text-xs text-[#7c775f]">
                        Trip Coordinator & Backpacker
                      </span>
                    </div>
                  </div>
                  <p className="font-sans text-sm sm:text-base text-[#121212] leading-relaxed italic">
                    &quot;Pas trip Bromo 8 orang kemarin bener-bener lifesaver. Yang biasanya pusing hitung sewa jeep, makan, dan tiket masuk, selesai seketika. Algoritma pelunasannya bikin kita hemat biaya admin bank ratusan ribu rupiah!&quot;
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t-2 border-[#121212] flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#F0EDEC] border-brutal-sm font-display text-[10px] uppercase font-bold text-[#121212]">
                    Kategori: Liburan Bareng
                  </span>
                  <div className="flex text-amber-500 text-sm">
                    ⭐⭐⭐⭐⭐
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <div className="bg-[#FFE600] border-brutal shadow-brutal-lg p-8 sm:p-14 text-center relative overflow-hidden">
            {/* Corner brutal decorations */}
            <div className="hidden sm:block absolute top-0 left-0 w-6 h-6 bg-[#121212]"></div>
            <div className="hidden sm:block absolute top-0 right-0 w-6 h-6 bg-[#121212]"></div>
            <div className="hidden sm:block absolute bottom-0 left-0 w-6 h-6 bg-[#121212]"></div>
            <div className="hidden sm:block absolute bottom-0 right-0 w-6 h-6 bg-[#121212]"></div>

            <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
              <span className="px-3 py-1 bg-white border-[2px] border-[#121212] font-display text-xs uppercase font-bold text-[#121212] shadow-brutal-sm">
                ⚡ SELESAIKAN DALAM 30 DETIK
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-black uppercase text-[#121212] leading-tight">
                SUDAH SIAP NONGKRONG TANPA PUSING HITUNG KEMBALIAN?
              </h2>
              <p className="font-sans text-sm sm:text-base text-[#121212] max-w-lg">
                Gabung bersama ratusan ribu pertemanan yang selamat dari drama salah hitung. Buat grup pertamamu sekarang secara gratis.
              </p>
              <div className="pt-2 w-full sm:w-auto">
                <Link
                  href={primaryTarget}
                  className="w-full sm:w-auto px-8 py-4 bg-[#121212] text-white font-display text-sm sm:text-base uppercase tracking-wider font-bold shadow-[6px_6px_0px_#fff] border-[3px] border-[#121212] inline-flex items-center justify-center gap-2 btn-brutal hover:bg-neutral-800"
                >
                  <span>Buat Grup Patungan Sekarang</span>
                  <span className="text-xl">➔</span>
                </Link>
              </div>
              <span className="font-display text-[11px] uppercase tracking-widest text-[#121212] font-bold mt-1">
                TIDAK PERLU KARTU KREDIT • LANGSUNG BUKA DARI BROWSER
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t-[3px] border-[#121212] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-center md:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="Patungin"
              className="w-5 h-5 inline-block"
            />
            <span className="px-2 py-0.5 bg-[#FF66C4] border-brutal-sm font-display text-xs uppercase text-white font-bold">
              PATUNGIN
            </span>
            <span className="font-display text-xs uppercase font-bold text-[#121212]">
              © {new Date().getFullYear()}
            </span>
            <span className="font-sans text-xs text-[#7c775f]">
              • Anti Riba, Anti Lupa, Lunas Seketika.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-display text-xs uppercase font-bold">
            <a href="#fitur" className="hover:underline text-[#121212]">
              Fitur
            </a>
            <a href="#cara-kerja" className="hover:underline text-[#121212]">
              Cara Kerja
            </a>
            <a href="#simulasi-hitung" className="hover:underline text-[#121212]">
              Simulasi
            </a>
            <a href="#testimoni" className="hover:underline text-[#121212]">
              Testimoni
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
