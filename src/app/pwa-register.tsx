"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Daftarkan Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("PWA Service Worker registration failed:", err);
        });
    }

    // 2. Cek apakah sudah berjalan di mode standalone
    if (typeof window !== "undefined") {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error navigator.standalone exists on iOS Safari
        window.navigator.standalone === true;

      setIsStandalone(isStandaloneMode);

      // Cek apakah iOS
      const ua = window.navigator.userAgent;
      const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream: boolean }).MSStream;
      setIsIos(isIosDevice);

      // Cek status dismiss di session
      const dismissed = sessionStorage.getItem("pwa_install_dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    }

    // 3. Tangani event beforeinstallprompt (Android / Chrome / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Jika sudah terpasang (standalone) atau ditutup pengguna, jangan tampilkan banner
  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa_install_dismissed", "true");
    }
  };

  // Hanya tampilkan jika prompt tersedia (Android/Chrome) ATAU jika iOS non-standalone
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      {/* Banner Ajakan Pasang (Neo-Brutalism Bottom Bar) */}
      <div className="fixed bottom-16 sm:bottom-6 left-4 right-4 z-40 max-w-lg mx-auto bg-[#FFE600] border-brutal shadow-brutal p-3.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl flex-shrink-0">📲</span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-xs sm:text-sm text-[#121212] uppercase tracking-wide truncate">
              Pasang Aplikasi Patungan
            </p>
            <p className="font-sans text-[11px] text-[#444444] truncate">
              Akses cepat tanpa browser dari layar utama ponselmu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="btn-brutal bg-[#121212] text-white px-3 py-1.5 font-display text-xs font-bold uppercase cursor-pointer hover:bg-black"
          >
            Pasang
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Tutup"
            className="w-7 h-7 bg-white border-brutal-sm flex items-center justify-center font-bold text-xs text-[#121212] cursor-pointer hover:bg-[#f0edec]"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Modal Panduan Instalasi Khusus iOS Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFDF5] border-brutal shadow-brutal max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b-[3px] border-[#121212] pb-2.5">
              <span className="font-display font-extrabold text-sm uppercase text-[#121212]">
                Cara Pasang di iPhone / iPad
              </span>
              <button
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 bg-white border-brutal-sm flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-[#FF66C4]"
              >
                ✕
              </button>
            </div>

            <ol className="space-y-3 font-sans text-xs text-[#121212] leading-relaxed list-decimal list-inside">
              <li>
                Buka website ini di peramban <b>Safari</b>.
              </li>
              <li>
                Ketuk tombol <b>Bagikan (Share)</b> <span className="inline-block p-1 bg-white border-brutal-sm text-sm">⎋</span> di bilah navigasi bawah Safari.
              </li>
              <li>
                Gulir ke bawah dan pilih <b>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</b> <span className="inline-block p-1 bg-white border-brutal-sm text-sm">➕</span>.
              </li>
              <li>
                Ketuk <b>Tambah</b> di pojok kanan atas layar Anda.
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full btn-brutal bg-[#00F090] text-[#121212] py-2 font-display text-xs font-bold uppercase cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
