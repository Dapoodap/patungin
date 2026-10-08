import { and, desc, eq, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/authz";
import { db } from "@/lib/db";
import { groups, expenses, members, settlements } from "@/lib/db/schema";
import { computeBalances, settle } from "@/lib/split";
import { RekapClientView } from "./rekap-client-view";

export default async function GroupOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member: currentMember } = await requireMember(id);

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });

  // 1. Fetch active members
  const groupMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, id), isNull(members.leftAt)),
  });

  // 2. Fetch active expenses with splits
  const activeExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.groupId, id), isNull(expenses.deletedAt)),
    orderBy: [desc(expenses.spentAt), desc(expenses.createdAt)],
    with: {
      splits: true,
      payer: true,
    },
  });

  // 3. Fetch confirmed settlements
  const confirmedSettlements = await db.query.settlements.findMany({
    where: and(
      eq(settlements.groupId, id),
      eq(settlements.status, "confirmed"),
    ),
  });

  // 4. Transform data for pure mathematical split engine
  const memberIds = groupMembers.map((m) => m.id);

  const expenseInputs = activeExpenses.map((e) => {
    const shares: Record<string, number> = {};
    for (const s of e.splits) {
      shares[s.memberId] = s.shareAmount;
    }
    return {
      payerId: e.payerMemberId,
      amount: e.amount,
      shares,
    };
  });

  const settlementInputs = confirmedSettlements.map((s) => ({
    fromId: s.fromMemberId,
    toId: s.toMemberId,
    amount: s.amount,
  }));

  // 5. Compute Balances & Settle
  const balances = computeBalances(memberIds, expenseInputs, settlementInputs);
  const transfers = settle(balances);

  // Calculate stats
  const totalExpense = activeExpenses.reduce((s, e) => s + e.amount, 0);

  // Per-member paid amounts & tanggungan (shares owed)
  const paidMap: Record<string, number> = Object.fromEntries(
    memberIds.map((mId) => [mId, 0]),
  );
  const shareMap: Record<string, number> = Object.fromEntries(
    memberIds.map((mId) => [mId, 0]),
  );

  for (const e of activeExpenses) {
    paidMap[e.payerMemberId] = (paidMap[e.payerMemberId] || 0) + e.amount;
    for (const s of e.splits) {
      shareMap[s.memberId] = (shareMap[s.memberId] || 0) + s.shareAmount;
    }
  }

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  for (const e of activeExpenses) {
    categoryTotals[e.category] =
      (categoryTotals[e.category] || 0) + e.amount;
  }
  const categorySorted = Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b - a,
  );

  // Check balance equilibrium: sum(balances) === 0 (US-E1)
  const sumBalances = Object.values(balances).reduce((a, b) => a + b, 0);
  const isBalanced = sumBalances === 0;

  return (
    <RekapClientView
      groupId={id}
      groupName={group?.name || "Grup Patungan"}
      currentMember={currentMember}
      members={groupMembers}
      expenses={activeExpenses}
      balances={balances}
      transfers={transfers}
      paidMap={paidMap}
      shareMap={shareMap}
      totalExpense={totalExpense}
      categorySorted={categorySorted}
      isBalanced={isBalanced}
    />
  );
}
