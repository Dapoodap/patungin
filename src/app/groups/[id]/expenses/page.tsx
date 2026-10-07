import { and, desc, eq, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/authz";
import { db } from "@/lib/db";
import { expenses, members } from "@/lib/db/schema";
import { ExpensesClientView } from "./expenses-client-view";

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member: currentMember } = await requireMember(id);

  const groupMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, id), isNull(members.leftAt)),
  });

  const activeExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.groupId, id), isNull(expenses.deletedAt)),
    orderBy: [desc(expenses.spentAt), desc(expenses.createdAt)],
    with: {
      splits: true,
      payer: true,
    },
  });

  return (
    <ExpensesClientView
      groupId={id}
      currentMember={currentMember}
      members={groupMembers}
      expenses={activeExpenses}
    />
  );
}
