"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, members, paymentMethods, auditLogs } from "@/lib/db/schema";
import { requireMember } from "@/lib/authz";
import {
  checkReminderCooldown,
  recordReminder,
} from "@/lib/reminders/cooldown";
import { formatWhatsAppReminder } from "@/lib/reminders/message";
import type { ActionResult } from "./group";

const triggerReminderSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  toMemberId: z.string().uuid("ID anggota tujuan tidak valid"),
  amount: z.coerce.number().positive("Nominal utang harus > 0"),
});

export async function triggerWhatsAppReminder(
  formData: FormData,
): Promise<
  ActionResult<{
    waUrl: string;
    message: string;
    lastReminderAt: string;
  }>
> {
  try {
    const parsed = triggerReminderSchema.safeParse({
      groupId: formData.get("groupId"),
      toMemberId: formData.get("toMemberId"),
      amount: formData.get("amount"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data pengingat tidak valid",
        },
      };
    }

    const { groupId, toMemberId, amount } = parsed.data;
    const { session, member: currentMember } = await requireMember(groupId);

    // Cooldown check 24 hours
    const cooldown = await checkReminderCooldown(groupId, toMemberId);
    if (!cooldown.canSend) {
      const hoursRemaining = Math.ceil(cooldown.remainingMs / (1000 * 60 * 60));
      return {
        ok: false,
        error: {
          code: "COOLDOWN_ACTIVE",
          message: `Pengingat baru saja dikirim ke anggota ini. Tunggu ${hoursRemaining} jam lagi sebelum mengirim pengingat berikutnya (cooldown 24 jam).`,
        },
      };
    }

    // Fetch debtor member
    const debtor = await db.query.members.findFirst({
      where: and(eq(members.id, toMemberId), eq(members.groupId, groupId)),
    });

    if (!debtor) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Anggota yang ditagih tidak ditemukan." },
      };
    }

    // Fetch group
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });

    if (!group) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Grup tidak ditemukan." },
      };
    }

    // Fetch current member's default payment method if available
    const myPaymentMethod = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.memberId, currentMember.id),
      orderBy: [desc(paymentMethods.isDefault), desc(paymentMethods.createdAt)],
    });

    const paymentText = myPaymentMethod
      ? `${myPaymentMethod.label} (${myPaymentMethod.value})`
      : undefined;

    const { message, waUrl } = formatWhatsAppReminder({
      borrowerName: debtor.displayName,
      creditorName: currentMember.displayName,
      groupName: group.name,
      amount,
      paymentMethodText: paymentText,
    });

    // Record reminder in DB
    const rec = await recordReminder({
      groupId,
      fromMemberId: currentMember.id,
      toMemberId,
      channel: "whatsapp_link",
      kind: "manual",
    });

    // Audit log
    await db.insert(auditLogs).values({
      groupId,
      actorUserId: session.user.id,
      action: "reminder.send",
      entity: "reminder",
      entityId: rec.id,
      meta: {
        toMemberId,
        debtorName: debtor.displayName,
        amount,
        channel: "whatsapp_link",
      },
      source: "user",
    });

    revalidatePath(`/groups/${groupId}/settle`);
    return {
      ok: true,
      data: {
        waUrl,
        message,
        lastReminderAt: rec.createdAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses pengingat WhatsApp";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function getMemberReminderCooldown(
  groupId: string,
  toMemberId: string,
) {
  return checkReminderCooldown(groupId, toMemberId);
}
