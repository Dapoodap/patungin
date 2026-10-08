import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  groups,
  members,
  expenses,
  settlements,
  paymentMethods,
  notificationPreferences,
} from "@/lib/db/schema";
import { computeBalances, settle } from "@/lib/split";
import {
  checkReminderCooldown,
  recordReminder,
} from "@/lib/reminders/cooldown";
import { sendReminderEmail } from "@/lib/reminders/email";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Secret authorization protection
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  const isAuthorized =
    (expectedSecret && authHeader === `Bearer ${expectedSecret}`) ||
    (expectedSecret && querySecret === expectedSecret) ||
    isDev; // Allow browser access in local development

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message:
          "Sertakan header Authorization: Bearer <CRON_SECRET> atau parameter ?secret=<CRON_SECRET> di URL.",
      },
      { status: 401 },
    );
  }

  // 1b. Instant Test Email Mode: ?test_email=kamu@gmail.com
  const testEmailTarget = url.searchParams.get("test_email");
  if (testEmailTarget) {
    const testResult = await sendReminderEmail({
      toEmail: testEmailTarget,
      debtorName: "Teman Patungan (Test)",
      creditorName: "Kamu (Test)",
      groupName: "Uji Coba Pengingat Email",
      amount: 50000,
      paymentMethodText: "BCA 123456789 a.n. Demo",
      settleUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/groups`,
    });

    return NextResponse.json({
      testMode: true,
      targetEmail: testEmailTarget,
      result: testResult,
      apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    });
  }

  try {
    // 2. Fetch all active groups (not archived)
    const activeGroups = await db.query.groups.findMany({
      where: isNull(groups.archivedAt),
      limit: 50,
    });

    let totalProcessed = 0;
    let skippedCooldown = 0;
    let skippedPending = 0;
    let totalSent = 0;
    const maxEmailsPerRun = 50; // Spec 8.4 batch limit
    const deliveries: Array<{
      toEmail: string;
      debtor: string;
      amount: number;
      success: boolean;
      resendId?: string;
      error?: string;
    }> = [];
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const group of activeGroups) {
      if (totalSent >= maxEmailsPerRun) break;

      // Fetch active members
      const groupMembers = await db.query.members.findMany({
        where: and(eq(members.groupId, group.id), isNull(members.leftAt)),
        with: { user: true },
      });

      if (groupMembers.length < 2) continue;

      const memberIds = groupMembers.map((m) => m.id);
      const memberMap = Object.fromEntries(groupMembers.map((m) => [m.id, m]));

      // Fetch active expenses with splits
      const activeExpenses = await db.query.expenses.findMany({
        where: and(eq(expenses.groupId, group.id), isNull(expenses.deletedAt)),
        with: { splits: true },
      });

      // Fetch confirmed settlements
      const confirmedSettlements = await db.query.settlements.findMany({
        where: and(
          eq(settlements.groupId, group.id),
          eq(settlements.status, "confirmed"),
        ),
      });

      // Fetch pending settlements (status 'paid')
      const pendingPaidSettlements = await db.query.settlements.findMany({
        where: and(
          eq(settlements.groupId, group.id),
          eq(settlements.status, "paid"),
        ),
      });

      // Compute transfers needed
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
      const transfers = settle(balances);

      for (const transfer of transfers) {
        if (totalSent >= maxEmailsPerRun) break;
        totalProcessed++;

        const debtor = memberMap[transfer.from];
        const creditor = memberMap[transfer.to];
        if (!debtor || !creditor || !debtor.userId || !debtor.user?.email) {
          continue; // Cannot email members without linked account
        }

        // Check if debtor already marked this transfer as paid (waiting for confirmation)
        const hasPendingSettlement = pendingPaidSettlements.some(
          (s) =>
            s.fromMemberId === transfer.from &&
            s.toMemberId === transfer.to &&
            s.amount >= transfer.amount,
        );
        if (hasPendingSettlement) {
          skippedPending++;
          continue;
        }

        // Check notification preferences
        const pref = await db.query.notificationPreferences.findFirst({
          where: eq(notificationPreferences.userId, debtor.userId),
        });

        if (pref && !pref.emailEnabled) {
          continue; // User opted out of email reminders
        }

        // Check 24-hour cooldown (can be bypassed in development with ?force=true)
        const forceCooldown = isDev && url.searchParams.get("force") === "true";
        if (!forceCooldown) {
          const cooldown = await checkReminderCooldown(group.id, debtor.id);
          if (!cooldown.canSend) {
            skippedCooldown++;
            continue;
          }
        }

        // Fetch creditor's payment method if available
        const creditorPayment = await db.query.paymentMethods.findFirst({
          where: eq(paymentMethods.memberId, creditor.id),
          orderBy: [desc(paymentMethods.isDefault), desc(paymentMethods.createdAt)],
        });

        const paymentText = creditorPayment
          ? `${creditorPayment.label} (${creditorPayment.value})`
          : undefined;

        // Record reminder in DB
        await recordReminder({
          groupId: group.id,
          fromMemberId: creditor.id,
          toMemberId: debtor.id,
          channel: "email",
          kind: "auto",
        });

        // Trigger email delivery
        const sendRes = await sendReminderEmail({
          toEmail: debtor.user.email,
          debtorName: debtor.displayName,
          creditorName: creditor.displayName,
          groupName: group.name,
          amount: transfer.amount,
          paymentMethodText: paymentText,
          settleUrl: `${appBaseUrl}/groups/${group.id}/settle`,
        });

        deliveries.push({
          toEmail: debtor.user.email,
          debtor: debtor.displayName,
          amount: transfer.amount,
          success: sendRes.success,
          resendId: sendRes.id,
          error: sendRes.error,
        });

        if (sendRes.success) {
          totalSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      groupsChecked: activeGroups.length,
      processed: totalProcessed,
      skippedCooldown,
      skippedPending,
      sent: totalSent,
      deliveries,
    });
  } catch (err: unknown) {
    console.error("Cron reminders error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 },
    );
  }
}
