"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupNav({
  groupId,
  isOwner,
}: {
  groupId: string;
  isOwner: boolean;
}) {
  const pathname = usePathname();

  const links = [
    {
      href: `/groups/${groupId}`,
      label: "Rekap",
      emoji: "📊",
      exact: true,
      bg: "bg-[#FFE600]",
    },
    {
      href: `/groups/${groupId}/expenses`,
      label: "Pengeluaran",
      emoji: "💸",
      exact: false,
      bg: "bg-[#00F090]",
    },
    {
      href: `/groups/${groupId}/settle`,
      label: "Bayar",
      emoji: "🤝",
      exact: false,
      bg: "bg-[#ffd8e9]",
    },
    {
      href: `/groups/${groupId}/members`,
      label: "Anggota",
      emoji: "👥",
      exact: false,
      bg: "bg-[#00D2FF]",
    },
  ];

  if (isOwner) {
    links.push({
      href: `/groups/${groupId}/history`,
      label: "Riwayat",
      emoji: "📜",
      exact: false,
      bg: "bg-[#ffb0cd]",
    });
  }

  const isActive = (item: (typeof links)[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden sm:flex items-center gap-1.5">
        {links.map((link) => {
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`btn-brutal px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-transform ${
                active
                  ? `${link.bg} shadow-none translate-x-[2px] translate-y-[2px]`
                  : "bg-white hover:bg-[#f0edec]"
              }`}
            >
              <span>{link.emoji}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}

        <Link
          href="/settings"
          className="btn-brutal bg-[#f0edec] px-2.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider ml-1"
          title="Pengaturan Akun & Rekening"
        >
          ⚙️
        </Link>
      </nav>

      {/* Mobile Bottom Navigation Bar (US-G2) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden bg-white border-t-[3px] border-[#121212] shadow-[0_-4px_0px_#121212] px-2 py-1 flex items-center justify-around">
        {links.map((link) => {
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center text-center transition-all ${
                active
                  ? `${link.bg} border-brutal-sm font-bold`
                  : "text-[#121212] font-semibold hover:bg-[#f0edec]"
              }`}
            >
              <span className="text-base leading-none">{link.emoji}</span>
              <span className="font-display text-[10px] uppercase tracking-tight mt-0.5">
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
