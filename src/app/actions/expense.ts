"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, expenseSplits, members, auditLogs, settlements } from "@/lib/db/schema";
import { requireMember } from "@/lib/authz";
import { alloc } from "@/lib/split/alloc";
import type { ActionResult } from "./group";

/* ==========================================================================
 * Zod Schemas
 * ========================================================================== */

const participantSchema = z.object({
  memberId: z.string().uuid("ID anggota tidak valid"),
  weight: z.number().positive("Bobot harus > 0").max(100, "Bobot maksimal 100"),
});

const createExpenseSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  title: z
    .string()
    .min(1, "Judul pengeluaran harus diisi")
    .max(120, "Judul maksimal 120 karakter"),
  category: z.string().default("lainnya"),
  amount: z.coerce.number().int("Nominal harus bilangan bulat rupiah").positive("Nominal harus > 0"),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  payerMemberId: z.string().uuid("Pilih anggota yang membayar"),
  note: z.string().max(255).optional(),
  participants: z
    .array(participantSchema)
    .min(1, "Pilih minimal satu orang yang menanggung"),
});

const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: z.string().uuid("ID pengeluaran tidak valid"),
});

/* ==========================================================================
 * Actions
 * ========================================================================== */

export async function createExpense(
  payload: z.infer<typeof createExpenseSchema>,
): Promise<ActionResult<{ expenseId: string }>> {
  try {
    const parsed = createExpenseSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data pengeluaran tidak valid",
        },
      };
    }

    const { data } = parsed;
    const { session, member: currentMember } = await requireMember(data.groupId);

    // 1. Verify payer and all participants belong to this same group and are active
    const memberIdsToVerify = Array.from(
      new Set([data.payerMemberId, ...data.participants.map((p) => p.memberId)]),
    );

    const verifiedMembers = await db.query.members.findMany({
      where: and(
        eq(members.groupId, data.groupId),
        inArray(members.id, memberIdsToVerify),
        isNull(members.leftAt),
      ),
    });

    if (verifiedMembers.length !== memberIdsToVerify.length) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message: "Pembayar atau peserta harus merupakan anggota aktif grup ini.",
        },
      };
    }

    // 2. Compute integer largest-remainder allocation using lib/split
    const weightsMap: Record<string, number> = {};
    for (const p of data.participants) {
      weightsMap[p.memberId] = p.weight;
    }

    const sharesMap = alloc(data.amount, weightsMap);

    // 3. Atomic transaction: insert expense + insert expense_splits + audit_logs
    const newExpense = await db.transaction(async (tx) => {
      const [exp] = await tx
        .insert(expenses)
        .values({
          groupId: data.groupId,
          payerMemberId: data.payerMemberId,
          title: data.title,
          category: data.category,
          amount: data.amount,
          spentAt: data.spentAt,
          note: data.note,
          createdByMemberId: currentMember.id,
        })
        .returning();

      // Insert splits
      const splitRows = Object.entries(sharesMap).map(([mId, shareAmt]) => {
        const weightVal = weightsMap[mId] || 1;
        return {
          expenseId: exp.id,
          memberId: mId,
          weight: weightVal.toFixed(2),
          shareAmount: shareAmt,
        };
      });

      await tx.insert(expenseSplits).values(splitRows);

      // Audit log
      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "expense.create",
        entity: "expense",
        entityId: exp.id,
        meta: { amount: data.amount, title: data.title },
      });

      return exp;
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/expenses`);
    return { ok: true, data: { expenseId: newExpense.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mencatat pengeluaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function updateExpense(
  payload: z.infer<typeof updateExpenseSchema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = updateExpenseSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data pengeluaran tidak valid",
        },
      };
    }

    const { data } = parsed;
    const { session, member: currentMember } = await requireMember(data.groupId);

    // Verify expense exists and belongs to this group
    const existingExpense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, data.expenseId),
        eq(expenses.groupId, data.groupId),
        isNull(expenses.deletedAt),
      ),
    });

    if (!existingExpense) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Pengeluaran tidak ditemukan",
        },
      };
    }

    // Authorization: only creator or owner can edit
    if (
      existingExpense.createdByMemberId !== currentMember.id &&
      currentMember.role !== "owner"
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Hanya pembuat pengeluaran atau owner yang dapat mengubah pengeluaran ini.",
        },
      };
    }

    // Verify members
    const memberIdsToVerify = Array.from(
      new Set([data.payerMemberId, ...data.participants.map((p) => p.memberId)]),
    );

    const verifiedMembers = await db.query.members.findMany({
      where: and(
        eq(members.groupId, data.groupId),
        inArray(members.id, memberIdsToVerify),
        isNull(members.leftAt),
      ),
    });

    if (verifiedMembers.length !== memberIdsToVerify.length) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message: "Pembayar atau peserta harus merupakan anggota aktif grup ini.",
        },
      };
    }

    // Check if group has confirmed settlements (US-D2 warning indicator in UI)
    const confirmedCount = await db.query.settlements.findFirst({
      where: and(
        eq(settlements.groupId, data.groupId),
        eq(settlements.status, "confirmed"),
      ),
    });

    const weightsMap: Record<string, number> = {};
    for (const p of data.participants) {
      weightsMap[p.memberId] = p.weight;
    }
    const sharesMap = alloc(data.amount, weightsMap);

    await db.transaction(async (tx) => {
      // 1. Update expense row
      await tx
        .update(expenses)
        .set({
          payerMemberId: data.payerMemberId,
          title: data.title,
          category: data.category,
          amount: data.amount,
          spentAt: data.spentAt,
          note: data.note,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, data.expenseId));

      // 2. Replace splits: delete old splits and insert new splits
      await tx
        .delete(expenseSplits)
        .where(eq(expenseSplits.expenseId, data.expenseId));

      const splitRows = Object.entries(sharesMap).map(([mId, shareAmt]) => ({
        expenseId: data.expenseId,
        memberId: mId,
        weight: (weightsMap[mId] || 1).toFixed(2),
        shareAmount: shareAmt,
      }));

      await tx.insert(expenseSplits).values(splitRows);

      // 3. Audit log
      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "expense.update",
        entity: "expense",
        entityId: data.expenseId,
        meta: {
          hasConfirmedSettlementWarning: !!confirmedCount,
          amount: data.amount,
        },
      });
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/expenses`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah pengeluaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
): Promise<ActionResult<void>> {
  try {
    const { session, member: currentMember } = await requireMember(groupId);

    const existing = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
        isNull(expenses.deletedAt),
      ),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Pengeluaran tidak ditemukan" },
      };
    }

    // Only creator or owner can delete
    if (
      existing.createdByMemberId !== currentMember.id &&
      currentMember.role !== "owner"
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Hanya pembuat pengeluaran atau owner yang dapat menghapus pengeluaran ini.",
        },
      };
    }

    // Soft delete
    await db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({ deletedAt: new Date() })
        .where(eq(expenses.id, expenseId));

      await tx.insert(auditLogs).values({
        groupId,
        actorUserId: session.user.id,
        action: "expense.delete",
        entity: "expense",
        entityId: expenseId,
      });
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/expenses`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus pengeluaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}
