import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, members, expenses, settlements, shareLinks } from "@/lib/db/schema";
import { hashShareToken } from "./token";
import { computeBalances, settle } from "@/lib/split";

export interface PublicMemberShareDTO {
  id: string;
  name: string;
  paid: number;
  share: number;
  balance: number;
}

export interface PublicTransferShareDTO {
  fromName: string;
  toName: string;
  amount: number;
}

export interface PublicExpenseItemShareDTO {
  id: string;
  title: string;
  amount: number;
  category: string;
  spentAt: string;
  payerName: string;
  splits: {
    memberName: string;
    shareAmount: number;
  }[];
}

export interface PublicGroupShareDTO {
  groupId: string;
  name: string;
  description: string | null;
  createdAt: string;
  expiresAt: string;
  showDetails: boolean;
  totalExpenses: number;
  members: PublicMemberShareDTO[];
  transfers: PublicTransferShareDTO[];
  categories: { name: string; amount: number }[];
  expenses?: PublicExpenseItemShareDTO[];
}

/**
 * Resolves a public read-only group share payload from a raw token.
 * Returns null if token does not exist, is expired, or was revoked.
 * Strictly guarantees no sensitive PII (emails, payment accounts, user IDs, audit logs, invites) is returned.
 */
export async function getPublicGroupShare(
  rawToken: string,
): Promise<PublicGroupShareDTO | null> {
  if (!rawToken || rawToken.trim().length === 0) {
    return null;
  }

  const tokenHash = hashShareToken(rawToken);

  const link = await db.query.shareLinks.findFirst({
    where: eq(shareLinks.tokenHash, tokenHash),
  });

  if (!link) {
    return null;
  }

  // Token revocation check
  if (link.revokedAt !== null) {
    return null;
  }

  // Token expiration check (default 30 days)
  if (new Date(link.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  // Increment view count asynchronously
  try {
    await db
      .update(shareLinks)
      .set({ viewCount: sql`${shareLinks.viewCount} + 1` })
      .where(eq(shareLinks.id, link.id));
  } catch (err) {
    console.error("Failed to increment share link view count:", err);
  }

  // Fetch group
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, link.groupId),
  });

  if (!group) {
    return null;
  }

  // Fetch active members only
  const activeMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, group.id), isNull(members.leftAt)),
  });

  const memberNameMap: Record<string, string> = {};
  for (const m of activeMembers) {
    memberNameMap[m.id] = m.displayName;
  }

  const memberIds = activeMembers.map((m) => m.id);

  // Fetch active expenses with splits
  const activeExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.groupId, group.id), isNull(expenses.deletedAt)),
    orderBy: [desc(expenses.spentAt), desc(expenses.createdAt)],
    with: {
      splits: true,
    },
  });

  // Fetch confirmed settlements
  const confirmedSettlements = await db.query.settlements.findMany({
    where: and(
      eq(settlements.groupId, group.id),
      eq(settlements.status, "confirmed"),
    ),
  });

  // Transform data for pure calculation engine
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

  const balances = computeBalances(memberIds, expenseInputs, settlementInputs);
  const rawTransfers = settle(balances);

  const totalExpenses = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Per-member paid & share tracking
  const paidMap: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0]),
  );
  const shareMap: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0]),
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
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  }
  const categories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({ name, amount }));

  // Format transfers with friendly display names
  const transfers: PublicTransferShareDTO[] = rawTransfers.map((t) => ({
    fromName: memberNameMap[t.from] || "Anggota",
    toName: memberNameMap[t.to] || "Anggota",
    amount: t.amount,
  }));

  // Build members DTO
  const memberDTOs: PublicMemberShareDTO[] = activeMembers.map((m) => ({
    id: m.id,
    name: m.displayName,
    paid: paidMap[m.id] || 0,
    share: shareMap[m.id] || 0,
    balance: balances[m.id] || 0,
  }));

  // Build sterilized DTO
  const result: PublicGroupShareDTO = {
    groupId: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    showDetails: link.showDetails,
    totalExpenses,
    members: memberDTOs,
    transfers,
    categories,
  };

  // If showDetails is explicitly enabled by owner, include sanitized expense list
  if (link.showDetails) {
    result.expenses = activeExpenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      spentAt:
        typeof e.spentAt === "string"
          ? e.spentAt
          : new Date(e.spentAt).toISOString(),
      payerName: memberNameMap[e.payerMemberId] || "Anggota",
      splits: e.splits.map((s) => ({
        memberName: memberNameMap[s.memberId] || "Anggota",
        shareAmount: s.shareAmount,
      })),
    }));
  }

  return result;
}
