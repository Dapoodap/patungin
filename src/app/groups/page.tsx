import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { members, groups } from "@/lib/db/schema";
import { SignOutButton } from "./sign-out-button";

export default async function GroupsPage() {
  const session = await requireUser();

  // Find all groups where the user is an active member
  const userMemberships = await db
    .select({
      memberId: members.id,
      role: members.role,
      groupId: groups.id,
      groupName: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
    })
    .from(members)
    .innerJoin(groups, eq(members.groupId, groups.id))
    .where(and(eq(members.userId, session.user.id), isNull(members.leftAt)));

  return (
    <main className="min-h-screen bg-[#FFFDF5] text-[#121212] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-[3px] border-[#121212] mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Patungin" className="w-6 h-6 inline-block" />
              <div className="inline-flex items-center gap-1.5 bg-[#FFE600] px-3 py-0.5 border-brutal-sm font-display text-xs font-bold uppercase tracking-wider">
                <span>Halo, {session.user.name || "Teman"}!</span>
              </div>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
              Daftar Grup Patungan
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/groups/new"
              className="btn-brutal bg-[#00F090] text-[#121212] px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <span>➕</span>
              <span>Buat Grup</span>
            </Link>
            <Link
              href="/settings"
              className="btn-brutal bg-[#f0edec] text-[#121212] px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
              title="Pengaturan Akun & Rekening"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Groups Grid / Empty State */}
        {userMemberships.length === 0 ? (
          <div className="bg-white border-brutal shadow-brutal p-8 text-center max-w-lg mx-auto my-8">
            <div className="w-16 h-16 bg-[#FFE600] border-brutal flex items-center justify-center font-display text-3xl mx-auto mb-4">
              👥
            </div>
            <h2 className="font-display text-xl font-bold mb-2">
              Belum Punya Grup Patungan
            </h2>
            <p className="font-sans text-sm text-[#4b4731] mb-6">
              Mulai dengan membuat grup patungan pertamamu untuk liburan, nongkrong, atau kosan. Atau minta temanmu mengirimkan link undangan!
            </p>
            <Link
              href="/groups/new"
              className="btn-brutal w-full bg-[#FFE600] text-[#121212] py-3 px-4 font-display text-sm font-bold uppercase tracking-wider inline-block"
            >
              Buat Grup Pertamamu Sekarang
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {userMemberships.map((g) => (
              <Link
                key={g.groupId}
                href={`/groups/${g.groupId}`}
                className="btn-brutal bg-white p-6 block hover:bg-[#FFFDF5] text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-display text-xl font-bold tracking-tight text-[#121212]">
                    {g.groupName}
                  </h2>
                  <span
                    className={`font-display text-xs font-bold uppercase px-2 py-0.5 border-brutal-sm ${
                      g.role === "owner" ? "bg-[#FFE600]" : "bg-[#00D2FF]"
                    }`}
                  >
                    {g.role}
                  </span>
                </div>

                {g.description && (
                  <p className="font-sans text-sm text-[#4b4731] mb-4 line-clamp-2">
                    {g.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs font-sans text-[#7c775f] pt-4 border-t-2 border-[#f0edec]">
                  <span>Buka Rekap & Pengeluaran</span>
                  <span className="font-bold text-[#121212]">Masuk ➔</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
