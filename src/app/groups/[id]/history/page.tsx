import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/authz";
import { db } from "@/lib/db";
import { auditLogs, groups, user } from "@/lib/db/schema";
import { HistoryClientView } from "./history-client-view";

export default async function GroupHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Authorization: Only owner can view history (US-G1, PRD FR-22)
  try {
    await requireOwner(id);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });

  if (!group) {
    notFound();
  }

  // Fetch all audit logs for this group
  const rawLogs = await db
    .select({
      id: auditLogs.id,
      groupId: auditLogs.groupId,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorUserId, user.id))
    .where(eq(auditLogs.groupId, id))
    .orderBy(desc(auditLogs.createdAt));

  return (
    <HistoryClientView
      groupId={id}
      groupName={group.name}
      logs={rawLogs}
    />
  );
}
