import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { reminders } from "@/lib/db/schema";

export const COOLDOWN_HOURS = 24;
export const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

export interface CooldownStatus {
  canSend: boolean;
  remainingMs: number;
  lastReminderAt: Date | null;
}

/**
 * Checks whether a reminder can be sent to a debtor member in a specific group.
 * A 24-hour cooldown is strictly enforced between any reminders sent to the same debtor in the group.
 */
export async function checkReminderCooldown(
  groupId: string,
  toMemberId: string,
): Promise<CooldownStatus> {
  const since = new Date(Date.now() - COOLDOWN_MS);

  const lastReminder = await db.query.reminders.findFirst({
    where: and(
      eq(reminders.groupId, groupId),
      eq(reminders.toMemberId, toMemberId),
      gt(reminders.createdAt, since),
    ),
    orderBy: [desc(reminders.createdAt)],
  });

  if (!lastReminder) {
    return {
      canSend: true,
      remainingMs: 0,
      lastReminderAt: null,
    };
  }

  const elapsedMs = Date.now() - lastReminder.createdAt.getTime();
  const remainingMs = Math.max(0, COOLDOWN_MS - elapsedMs);

  return {
    canSend: remainingMs <= 0,
    remainingMs,
    lastReminderAt: lastReminder.createdAt,
  };
}

/**
 * Records an executed reminder (manual WhatsApp or auto email) in the database.
 */
export async function recordReminder(params: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  channel: "whatsapp_link" | "email" | "push";
  kind: "manual" | "auto";
}) {
  const [created] = await db
    .insert(reminders)
    .values({
      groupId: params.groupId,
      fromMemberId: params.fromMemberId,
      toMemberId: params.toMemberId,
      channel: params.channel,
      kind: params.kind,
    })
    .returning();

  return created;
}
