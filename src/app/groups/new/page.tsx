"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGroup } from "@/app/actions/group";

export default function NewGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await createGroup(formData);

    if (!res.ok) {
      setErrorMsg(res.error.message);
      setLoading(false);
    } else {
      router.push(`/groups/${res.data.groupId}`);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFFDF5] text-[#121212] p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <Link
          href="/groups"
          className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider mb-4 hover:underline text-[#4b4731]"
        >
          <span>⬅️</span>
          <span>Kembali ke Daftar Grup</span>
        </Link>

        <div className="bg-white border-brutal shadow-brutal p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 bg-[#FFE600] border-brutal-sm flex items-center justify-center font-display text-sm font-bold">
              ✨
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Buat Grup Patungan Baru
            </h1>
          </div>
          <p className="font-sans text-sm text-[#4b4731] mb-6">
            Beri nama grup dan undang teman-temanmu untuk membagi pengeluaran dengan adil.
          </p>

          {errorMsg && (
            <div className="bg-[#ffdad6] border-brutal-sm p-3 mb-6 text-[#ba1a1a] font-sans text-xs font-semibold flex items-start gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block font-display text-xs font-bold uppercase tracking-wider mb-1"
              >
                Nama Grup <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Mis. Trip Jogja 2026, Kos Mawar, Makan Malam"
                className="w-full bg-[#f6f3f2] border-brutal-sm p-3 font-sans text-sm outline-none focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block font-display text-xs font-bold uppercase tracking-wider mb-1"
              >
                Deskripsi / Catatan (Opsional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Mis. Liburan 3 hari 2 malam keliling Jogja bareng kiki & rakya"
                className="w-full bg-[#f6f3f2] border-brutal-sm p-3 font-sans text-sm outline-none focus:bg-white resize-none"
              ></textarea>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-brutal w-full bg-[#00F090] text-[#121212] py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider cursor-pointer"
              >
                {loading ? "Menyimpan Grup..." : "Simpan & Masuk Grup ➔"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
