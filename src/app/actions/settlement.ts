"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { settlements, members, auditLogs } from "@/lib/db/schema";
import { requireMember, requireOwner } from "@/lib/authz";
import type { ActionResult } from "./group";

/* ==========================================================================
 * Schemas
 * ========================================================================== */

const createSettlementSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  fromMemberId: z.string().uuid("ID pengirim tidak valid"),
  toMemberId: z.string().uuid("ID penerima tidak valid"),
  amount: z.coerce
    .number()
    .int("Nominal harus bilangan bulat rupiah")
    .positive("Nominal harus > 0"),
  note: z.string().max(255).optional(),
});

/* ==========================================================================
 * Actions
 * ========================================================================== */

/**
 * Create a settlement record: debtor marks transfer as "paid".
 * Status: "paid" (awaiting confirmation from creditor).
 */
export async function createSettlement(
  payload: z.infer<typeof createSettlementSchema>,
): Promise<ActionResult<{ settlementId: string }>> {
  try {
    const parsed = createSettlementSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message || "Data pelunasan tidak valid",
        },
      };
    }

    const { data } = parsed;

    if (data.fromMemberId === data.toMemberId) {
      return {
        ok: false,
        error: {
          code: "INVALID_TRANSFER",
          message: "Pengirim dan penerima harus berbeda.",
        },
      };
    }

    const { session } = await requireMember(data.groupId);

    // Verify both members exist in this group and are active
    const fromMember = await db.query.members.findFirst({
      where: and(
        eq(members.id, data.fromMemberId),
        eq(members.groupId, data.groupId),
        isNull(members.leftAt),
      ),
    });

    const toMember = await db.query.members.findFirst({
      where: and(
        eq(members.id, data.toMemberId),
        eq(members.groupId, data.groupId),
        isNull(members.leftAt),
      ),
    });

    if (!fromMember || !toMember) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message:
            "Pengirim atau penerima harus merupakan anggota aktif grup ini.",
        },
      };
    }

    const newSettlement = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(settlements)
        .values({
          groupId: data.groupId,
          fromMemberId: data.fromMemberId,
          toMemberId: data.toMemberId,
          amount: data.amount,
          status: "paid",
          method: "manual",
          note: data.note,
          paidAt: new Date(),
        })
        .returning();

      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "settlement.create",
        entity: "settlement",
        entityId: s.id,
        meta: {
          from: fromMember.displayName,
          to: toMember.displayName,
          amount: data.amount,
        },
      });

      return s;
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/settle`);
    return { ok: true, data: { settlementId: newSettlement.id } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mencatat pelunasan";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

/**
 * Confirm a settlement: creditor (or owner) verifies that money was received.
 * Status changes from "paid" → "confirmed".
 * Only confirmed settlements affect final balances.
 */
export async function confirmSettlement(
  groupId: string,
  settlementId: string,
): Promise<ActionResult<void>> {
  try {
    const { session, member: currentMember } = await requireMember(groupId);

    const existing = await db.query.settlements.findFirst({
      where: and(
        eq(settlements.id, settlementId),
        eq(settlements.groupId, groupId),
      ),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Pelunasan tidak ditemukan" },
      };
    }

    if (existing.status !== "paid") {
      return {
        ok: false,
        error: {
          code: "INVALID_STATUS",
          message: `Pelunasan berstatus "${existing.status}", tidak bisa dikonfirmasi.`,
        },
      };
    }

    // Authorization: only the creditor (toMember) or owner can confirm
    const isCreditor = existing.toMemberId === currentMember.id;
    const isOwner = currentMember.role === "owner";

    if (!isCreditor && !isOwner) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Hanya penerima transfer atau owner yang dapat mengonfirmasi pelunasan.",
        },
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedByMemberId: currentMember.id,
        })
        .where(eq(settlements.id, settlementId));

      await tx.insert(auditLogs).values({
        groupId,
        actorUserId: session.user.id,
        action: "settlement.confirm",
        entity: "settlement",
        entityId: settlementId,
      });
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settle`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mengonfirmasi pelunasan";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

/**
 * Reject a settlement: creditor says money wasn't received.
 * Status changes from "paid" → "rejected".
 * Debtor can reattempt by creating a new settlement.
 */
export async function rejectSettlement(
  groupId: string,
  settlementId: string,
): Promise<ActionResult<void>> {
  try {
    const { session, member: currentMember } = await requireMember(groupId);

    const existing = await db.query.settlements.findFirst({
      where: and(
        eq(settlements.id, settlementId),
        eq(settlements.groupId, groupId),
      ),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Pelunasan tidak ditemukan" },
      };
    }

    if (existing.status !== "paid") {
      return {
        ok: false,
        error: {
          code: "INVALID_STATUS",
          message: `Pelunasan berstatus "${existing.status}", tidak bisa ditolak.`,
        },
      };
    }

    // Authorization: only the creditor or owner can reject
    const isCreditor = existing.toMemberId === currentMember.id;
    const isOwner = currentMember.role === "owner";

    if (!isCreditor && !isOwner) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Hanya penerima transfer atau owner yang dapat menolak pelunasan.",
        },
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({ status: "rejected" })
        .where(eq(settlements.id, settlementId));

      await tx.insert(auditLogs).values({
        groupId,
        actorUserId: session.user.id,
        action: "settlement.reject",
        entity: "settlement",
        entityId: settlementId,
      });
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settle`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menolak pelunasan";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

/**
 * Record a direct settlement by Owner (US-F4, PRD FR-19).
 * Owner can record offline/cash payment between any two members directly as confirmed.
 */
export async function recordDirectSettlement(
  payload: z.infer<typeof createSettlementSchema>,
): Promise<ActionResult<{ settlementId: string }>> {
  try {
    const parsed = createSettlementSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message || "Data pelunasan tidak valid",
        },
      };
    }

    const { data } = parsed;

    if (data.fromMemberId === data.toMemberId) {
      return {
        ok: false,
        error: {
          code: "INVALID_TRANSFER",
          message: "Pengirim dan penerima harus berbeda.",
        },
      };
    }

    const { session, member: currentMember } = await requireOwner(data.groupId);

    const fromMember = await db.query.members.findFirst({
      where: and(
        eq(members.id, data.fromMemberId),
        eq(members.groupId, data.groupId),
        isNull(members.leftAt),
      ),
    });

    const toMember = await db.query.members.findFirst({
      where: and(
        eq(members.id, data.toMemberId),
        eq(members.groupId, data.groupId),
        isNull(members.leftAt),
      ),
    });

    if (!fromMember || !toMember) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message:
            "Pengirim atau penerima harus merupakan anggota aktif grup ini.",
        },
      };
    }

    const newSettlement = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(settlements)
        .values({
          groupId: data.groupId,
          fromMemberId: data.fromMemberId,
          toMemberId: data.toMemberId,
          amount: data.amount,
          status: "confirmed",
          method: "manual",
          note: data.note || "Dicatat langsung oleh owner",
          paidAt: new Date(),
          confirmedAt: new Date(),
          confirmedByMemberId: currentMember.id,
        })
        .returning();

      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "settlement.direct",
        entity: "settlement",
        entityId: s.id,
        meta: {
          from: fromMember.displayName,
          to: toMember.displayName,
          amount: data.amount,
          recordedByOwner: true,
        },
      });

      return s;
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/settle`);
    return { ok: true, data: { settlementId: newSettlement.id } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mencatat pelunasan langsung";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

