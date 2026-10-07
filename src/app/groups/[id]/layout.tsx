import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/authz";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { GroupNav } from "./group-nav";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Strict authorization: requires active membership or throws 404 (US-B3)
  const { member } = await requireMember(id);

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });

  if (!group) {
    return null;
  }

  const isOwner = member.role === "owner";

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#121212] flex flex-col pb-20 sm:pb-8">
      {/* Top Header */}
      <header className="border-b-[3px] border-[#121212] bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/groups"
              className="btn-brutal bg-[#f0edec] px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
              title="Kembali ke daftar grup"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Patungin" className="w-4 h-4 inline-block" />
              <span>Grup</span>
            </Link>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight truncate max-w-[180px] sm:max-w-md">
                {group.name}
              </h1>
              <span className="font-sans text-[11px] text-[#4b4731] block">
                Peranmu: <strong className="uppercase">{member.role}</strong>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <GroupNav groupId={id} isOwner={isOwner} />
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

