import { and, desc, eq, isNull } from "drizzle-orm";
import { requireMember } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  expenses,
  members,
  settlements,
  paymentMethods,
} from "@/lib/db/schema";
import { computeBalances, settle } from "@/lib/split";
import { SettleClientView } from "./settle-client-view";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member: currentMember } = await requireMember(id);

  // 1. Fetch active members
  const groupMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, id), isNull(members.leftAt)),
  });

  // 2. Fetch active expenses with splits
  const activeExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.groupId, id), isNull(expenses.deletedAt)),
    with: { splits: true },
  });

  // 3. Fetch all settlements (for display and balance calc)
  const allSettlements = await db.query.settlements.findMany({
    where: eq(settlements.groupId, id),
    orderBy: [desc(settlements.createdAt)],
  });

  // 4. Fetch payment methods for all members
  const allPaymentMethods = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.memberId, members.id),
  });

  // Actually, get payment methods through member IDs
  const memberIds = groupMembers.map((m) => m.id);
  const paymentMethodsList: Array<typeof paymentMethods.$inferSelect> = [];
  for (const mId of memberIds) {
    const pms = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.memberId, mId),
    });
    paymentMethodsList.push(...pms);
  }

  // 5. Compute balances using only confirmed settlements
  const confirmedSettlements = allSettlements.filter(
    (s) => s.status === "confirmed",
  );

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

  const balances = computeBalances(
    memberIds,
    expenseInputs,
    settlementInputs,
  );
  const suggestedTransfers = settle(balances);

  return (
    <SettleClientView
      groupId={id}
      currentMember={currentMember}
      members={groupMembers}
      balances={balances}
      suggestedTransfers={suggestedTransfers}
      allSettlements={allSettlements}
      paymentMethods={paymentMethodsList}
    />
  );
}
