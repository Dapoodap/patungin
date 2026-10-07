"use client";

import { Suspense, useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-display">Memuat...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/groups";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "login") {
        const res = await signIn.email({
          email,
          password,
        });
        if (res.error) {
          setErrorMsg(
            res.error.message || "Email atau kata sandi salah. Silakan coba lagi.",
          );
        } else {
          router.push(nextUrl);
          router.refresh();
        }
      } else {
        if (password.length < 8) {
          setErrorMsg("Kata sandi minimal 8 karakter demi keamanan akun Anda.");
          setLoading(false);
          return;
        }
        const res = await signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
        });
        if (res.error) {
          setErrorMsg(res.error.message || "Pendaftaran gagal. Silakan coba lagi.");
        } else {
          router.push(nextUrl);
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: nextUrl,
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal masuk lewat akun Google.",
      );
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Top Branding Pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 bg-[#FFE600] px-3 py-1 border-brutal shadow-brutal-sm font-display text-xs font-bold uppercase tracking-wider">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Patungin" className="w-5 h-5" />
            <span>Patungin</span>
          </div>
          <span className="font-sans text-xs text-[#4b4731] font-semibold">
            Split Bill Tanpa Drama
          </span>
        </div>

        {/* Auth Box */}
        <div className="bg-white border-brutal shadow-brutal p-6">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#121212] mb-1">
              {mode === "login" ? "Masuk ke Akun" : "Bikin Akun Baru"}
            </h1>
            <p className="font-sans text-sm text-[#4b4731]">
              Biar bisa catat patungan, cek saldo, dan transfer bareng teman dengan adil.
            </p>
          </div>

          {/* Google Auth Button */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="btn-brutal w-full bg-[#FFE600] text-[#121212] font-display font-bold text-sm py-3 px-4 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"
                  fill="#000000"
                />
              </svg>
              <span>Lanjut Pake Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex py-2 items-center mb-5">
            <div className="grow border-t-2 border-[#121212]"></div>
            <span className="shrink mx-3 bg-[#f0edec] px-2 py-0.5 border-brutal-sm font-display text-xs font-bold uppercase text-[#121212]">
              Atau Pakai Email
            </span>
            <div className="grow border-t-2 border-[#121212]"></div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="bg-[#ffdad6] border-brutal-sm p-3 mb-4 text-[#ba1a1a] font-sans text-xs font-semibold flex items-start gap-2">
              <span className="font-bold">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                  Nama Panggilan
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mis. Dimas, Kiki, Daffa"
                  className="w-full bg-[#f6f3f2] border-brutal-sm p-2.5 font-sans text-sm outline-none focus:bg-white"
                />
              </div>
            )}

            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2.5 font-sans text-sm outline-none focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full bg-[#f6f3f2] border-brutal-sm p-2.5 font-sans text-sm outline-none focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-brutal w-full bg-[#00F090] text-[#121212] font-display font-bold text-sm py-3 px-4 uppercase tracking-wider cursor-pointer"
            >
              {loading ? "Memproses..." : mode === "login" ? "Masuk Sekarang" : "Daftar Akun"}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="mt-5 pt-4 border-t-2 border-[#f0edec] text-center">
            {mode === "login" ? (
              <p className="font-sans text-xs text-[#4b4731]">
                Belum punya akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg(null);
                  }}
                  className="font-bold underline text-[#121212] cursor-pointer"
                >
                  Bikin akun baru di sini
                </button>
              </p>
            ) : (
              <p className="font-sans text-xs text-[#4b4731]">
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                  }}
                  className="font-bold underline text-[#121212] cursor-pointer"
                >
                  Masuk ke akunmu
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
