"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      type="button"
      className="btn-brutal bg-[#f0edec] hover:bg-[#ffdad6] text-[#121212] px-3 py-2 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
    >
      {loading ? "..." : "Keluar"}
    </button>
  );
}
