import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, isNull, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/authz";
import { hashToken } from "@/lib/invite-token";
import { db } from "@/lib/db";
import { invites, groups, members } from "@/lib/db/schema";
import { acceptInvite } from "@/app/actions/group";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tHash = hashToken(token);

  // Lookup invite
  const inv = await db.query.invites.findFirst({
    where: and(
      eq(invites.tokenHash, tHash),
      isNull(invites.revokedAt),
      sql`${invites.expiresAt} > NOW()`,
      sql`${invites.usedCount} < ${invites.maxUses}`,
    ),
  });

  if (!inv) {
    return (
      <main className="min-h-screen bg-[#FFFDF5] text-[#121212] p-4 flex items-center justify-center">
        <div className="bg-white border-brutal shadow-brutal p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-[#ffdad6] border-brutal-sm text-[#ba1a1a] text-2xl flex items-center justify-center mx-auto mb-4">
            ❌
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">
            Link Undangan Tidak Berlaku
          </h1>
          <p className="font-sans text-sm text-[#4b4731] mb-6">
            Link ini mungkin sudah kedaluwarsa, dicabut oleh owner grup, atau kuota pemakaiannya sudah habis. Silakan minta link baru kepada pembuat grup.
          </p>
          <Link
            href="/groups"
            className="btn-brutal bg-[#FFE600] text-[#121212] py-3 px-4 font-display text-xs font-bold uppercase tracking-wider block"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, inv.groupId),
  });

  const session = await getSession();

  // If not authenticated, redirect to login with return URL (US-C3)
  if (!session) {
    redirect(`/login?next=/join/${token}`);
  }

  // If already member, redirect directly to group
  const alreadyMember = await db.query.members.findFirst({
    where: and(
      eq(members.groupId, inv.groupId),
      eq(members.userId, session.user.id),
      isNull(members.leftAt),
    ),
  });

  if (alreadyMember) {
    redirect(`/groups/${inv.groupId}`);
  }

  // Join Action form handler
  async function handleJoin() {
    "use server";
    const res = await acceptInvite(token);
    if (res.ok) {
      redirect(`/groups/${res.data.groupId}`);
    } else {
      redirect(`/groups?error=${encodeURIComponent(res.error.message)}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFDF5] text-[#121212] p-4 flex items-center justify-center">
      <div className="bg-white border-brutal shadow-brutal p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-[#00D2FF] border-brutal-sm text-2xl flex items-center justify-center mx-auto mb-4">
          👋
        </div>

        <div className="inline-flex items-center gap-1.5 bg-[#FFE600] px-3 py-0.5 border-brutal-sm font-display text-xs font-bold uppercase tracking-wider mb-2">
          <span>Undangan Masuk Grup</span>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
          {group?.name}
        </h1>

        {group?.description && (
          <p className="font-sans text-sm text-[#4b4731] mb-6">
            {group.description}
          </p>
        )}

        <div className="bg-[#f6f3f2] border-brutal-sm p-4 mb-6 text-left">
          <span className="font-display text-xs font-bold uppercase text-[#121212] block mb-1">
            Status Undangan:
          </span>
          <p className="font-sans text-xs text-[#7c775f]">
            Sisa Kuota: <strong>{inv.maxUses - inv.usedCount} orang lagi</strong>
          </p>
          <p className="font-sans text-xs text-[#7c775f]">
            Masuk sebagai: <strong>{session.user.name}</strong> ({session.user.email})
          </p>
        </div>

        <form action={handleJoin}>
          <button
            type="submit"
            className="btn-brutal w-full bg-[#00F090] text-[#121212] py-3.5 px-4 font-display text-sm font-bold uppercase tracking-wider cursor-pointer"
          >
            Gabung ke Grup Sekarang! ➔
          </button>
        </form>
      </div>
    </main>
  );
}
