import { and, eq, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/authz";
import { db } from "@/lib/db";
import { members, invites } from "@/lib/db/schema";
import { MemberManagementClient } from "./member-management-client";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member: currentMember } = await requireMember(id);

  // Get active members
  const activeMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, id), isNull(members.leftAt)),
  });

  // Get active invites (only if owner)
  let activeInvites: Array<typeof invites.$inferSelect> = [];
  if (currentMember.role === "owner") {
    activeInvites = await db.query.invites.findMany({
      where: and(eq(invites.groupId, id), isNull(invites.revokedAt)),
    });
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="border-b-[3px] border-[#121212] pb-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          Kelola Anggota & Undangan
        </h2>
        <p className="font-sans text-sm text-[#4b4731]">
          Atur peran anggota, buat link undangan berbatas kuota, atau tambahkan nama teman sebelum mereka punya akun.
        </p>
      </div>

      <MemberManagementClient
        groupId={id}
        currentMember={currentMember}
        membersList={activeMembers}
        invitesList={activeInvites}
      />
    </div>
  );
}
