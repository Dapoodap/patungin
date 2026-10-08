"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  expenses,
  expenseSplits,
  expenseItems,
  expenseItemShares,
  expenseAdjustments,
  members,
  auditLogs,
  settlements,
} from "@/lib/db/schema";
import { requireMember } from "@/lib/authz";
import { alloc, allocPercent, allocExact, allocItems } from "@/lib/split";
import type { ActionResult } from "./group";

/* ==========================================================================
 * Zod Schemas
 * ========================================================================== */

const participantSchema = z.object({
  memberId: z.string().uuid("ID anggota tidak valid"),
  inputValue: z.number().min(0, "Nilai porsi harus >= 0").optional(),
  weight: z.number().optional(),
});

const receiptItemSchema = z.object({
  name: z.string().min(1, "Nama item harus diisi").max(100),
  amount: z.coerce
    .number()
    .int("Harga item harus integer")
    .positive("Harga item harus > 0"),
  shares: z.record(z.string().uuid(), z.number().positive()),
});

const receiptAdjustmentSchema = z.object({
  kind: z.enum(["tax", "service", "tip", "discount"]),
  amount: z.coerce.number().int("Nominal penyesuaian harus integer").min(0),
  allocation: z.enum(["proportional", "equal"]).default("proportional"),
});

const createExpenseSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  title: z
    .string()
    .min(1, "Judul pengeluaran harus diisi")
    .max(120, "Judul maksimal 120 karakter"),
  category: z.string().default("lainnya"),
  amount: z.coerce
    .number()
    .int("Nominal harus bilangan bulat rupiah")
    .min(0, "Nominal harus >= 0"),
  spentAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  payerMemberId: z.string().uuid("Pilih anggota yang membayar"),
  splitMode: z.enum(["weight", "percent", "exact", "items"]).default("weight"),
  note: z.string().max(255).optional(),
  participants: z.array(participantSchema).optional().default([]),
  items: z.array(receiptItemSchema).optional(),
  adjustments: z.array(receiptAdjustmentSchema).optional(),
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

    const mode = data.splitMode || "weight";

    // 1. Verify members & calculate shares based on mode
    let targetAmount = data.amount;
    let sharesMap: Record<string, number> = {};
    const inputValuesMap: Record<string, number> = {};
    const memberIdsToVerify = new Set<string>([data.payerMemberId]);

    if (mode === "items") {
      if (!data.items || data.items.length === 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Daftar item struk harus berisi minimal 1 item belanja",
          },
        };
      }

      // Collect all members participating in any receipt item
      for (const item of data.items) {
        for (const [mId, porsi] of Object.entries(item.shares)) {
          if (porsi > 0) memberIdsToVerify.add(mId);
        }
      }

      const allMembersList = Array.from(memberIdsToVerify);
      try {
        sharesMap = allocItems(
          data.items,
          data.adjustments || [],
          allMembersList,
        );

        // Grand total from items and adjustments
        const itemsTotal = data.items.reduce((s, i) => s + i.amount, 0);
        const adjTotal = (data.adjustments || []).reduce((s, a) => {
          return a.kind === "discount" ? s - a.amount : s + a.amount;
        }, 0);
        targetAmount = itemsTotal + adjTotal;
        if (targetAmount <= 0) {
          throw new Error("Total tagihan struk setelah diskon harus > 0");
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Gagal menghitung alokasi struk belanja",
          },
        };
      }
    } else {
      if (!data.participants || data.participants.length === 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Pilih minimal satu orang yang menanggung pengeluaran",
          },
        };
      }
      if (data.amount <= 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Nominal pengeluaran harus lebih dari 0",
          },
        };
      }

      for (const p of data.participants) {
        memberIdsToVerify.add(p.memberId);
        inputValuesMap[p.memberId] = p.inputValue ?? p.weight ?? 1;
      }

      try {
        if (mode === "percent") {
          sharesMap = allocPercent(data.amount, inputValuesMap);
        } else if (mode === "exact") {
          sharesMap = allocExact(data.amount, inputValuesMap);
        } else {
          sharesMap = alloc(data.amount, inputValuesMap);
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Gagal menghitung alokasi pembagian",
          },
        };
      }
    }

    // Verify all involved members belong to this group and are active
    const verifiedMembers = await db.query.members.findMany({
      where: and(
        eq(members.groupId, data.groupId),
        inArray(members.id, Array.from(memberIdsToVerify)),
        isNull(members.leftAt),
      ),
    });

    if (verifiedMembers.length !== memberIdsToVerify.size) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message: "Pembayar atau peserta harus merupakan anggota aktif grup ini.",
        },
      };
    }

    // 2. Atomic transaction: insert expense + splits + receipt tables + audit_log
    const newExpense = await db.transaction(async (tx) => {
      const [exp] = await tx
        .insert(expenses)
        .values({
          groupId: data.groupId,
          payerMemberId: data.payerMemberId,
          title: data.title,
          category: data.category,
          amount: targetAmount,
          spentAt: data.spentAt,
          splitMode: mode,
          note: data.note,
          createdByMemberId: currentMember.id,
        })
        .returning();

      // Insert splits (sharesMap)
      const splitRows = Object.entries(sharesMap)
        .filter(([, shareAmt]) => shareAmt > 0)
        .map(([mId, shareAmt]) => {
          const inputVal = inputValuesMap[mId] ?? 1;
          return {
            expenseId: exp.id,
            memberId: mId,
            inputValue: inputVal.toFixed(2),
            shareAmount: shareAmt,
          };
        });

      if (splitRows.length > 0) {
        await tx.insert(expenseSplits).values(splitRows);
      }

      // If receipt items mode, insert items, item shares, and adjustments
      if (mode === "items" && data.items) {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          const [insertedItem] = await tx
            .insert(expenseItems)
            .values({
              expenseId: exp.id,
              name: item.name,
              amount: item.amount,
              position: idx,
            })
            .returning();

          // Calculate share amounts per participant on this item
          const itemShareAmounts = alloc(item.amount, item.shares);
          const itemShareRows = Object.entries(item.shares).map(
            ([mId, porsi]) => ({
              itemId: insertedItem.id,
              memberId: mId,
              inputValue: porsi.toFixed(2),
              shareAmount: itemShareAmounts[mId] || 0,
            }),
          );

          if (itemShareRows.length > 0) {
            await tx.insert(expenseItemShares).values(itemShareRows);
          }
        }

        if (data.adjustments && data.adjustments.length > 0) {
          const adjRows = data.adjustments
            .filter((a) => a.amount > 0)
            .map((a) => ({
              expenseId: exp.id,
              kind: a.kind,
              amount: a.amount,
              allocation: a.allocation,
            }));
          if (adjRows.length > 0) {
            await tx.insert(expenseAdjustments).values(adjRows);
          }
        }
      }

      // Audit log
      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "expense.create",
        entity: "expense",
        entityId: exp.id,
        meta: { amount: targetAmount, title: data.title, mode },
        source: "user",
      });

      return exp;
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/expenses`);
    return { ok: true, data: { expenseId: newExpense.id } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mencatat pengeluaran";
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
          message:
            "Hanya pembuat pengeluaran atau owner yang dapat mengubah pengeluaran ini.",
        },
      };
    }

    const mode = data.splitMode || "weight";
    let targetAmount = data.amount;
    let sharesMap: Record<string, number> = {};
    const inputValuesMap: Record<string, number> = {};
    const memberIdsToVerify = new Set<string>([data.payerMemberId]);

    if (mode === "items") {
      if (!data.items || data.items.length === 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Daftar item struk harus berisi minimal 1 item belanja",
          },
        };
      }

      for (const item of data.items) {
        for (const [mId, porsi] of Object.entries(item.shares)) {
          if (porsi > 0) memberIdsToVerify.add(mId);
        }
      }

      const allMembersList = Array.from(memberIdsToVerify);
      try {
        sharesMap = allocItems(
          data.items,
          data.adjustments || [],
          allMembersList,
        );

        const itemsTotal = data.items.reduce((s, i) => s + i.amount, 0);
        const adjTotal = (data.adjustments || []).reduce((s, a) => {
          return a.kind === "discount" ? s - a.amount : s + a.amount;
        }, 0);
        targetAmount = itemsTotal + adjTotal;
        if (targetAmount <= 0) {
          throw new Error("Total tagihan struk setelah diskon harus > 0");
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Gagal menghitung alokasi struk belanja",
          },
        };
      }
    } else {
      if (!data.participants || data.participants.length === 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Pilih minimal satu orang yang menanggung pengeluaran",
          },
        };
      }
      if (data.amount <= 0) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Nominal pengeluaran harus lebih dari 0",
          },
        };
      }

      for (const p of data.participants) {
        memberIdsToVerify.add(p.memberId);
        inputValuesMap[p.memberId] = p.inputValue ?? p.weight ?? 1;
      }

      try {
        if (mode === "percent") {
          sharesMap = allocPercent(data.amount, inputValuesMap);
        } else if (mode === "exact") {
          sharesMap = allocExact(data.amount, inputValuesMap);
        } else {
          sharesMap = alloc(data.amount, inputValuesMap);
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Gagal menghitung alokasi pembagian",
          },
        };
      }
    }

    const verifiedMembers = await db.query.members.findMany({
      where: and(
        eq(members.groupId, data.groupId),
        inArray(members.id, Array.from(memberIdsToVerify)),
        isNull(members.leftAt),
      ),
    });

    if (verifiedMembers.length !== memberIdsToVerify.size) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEMBERS",
          message: "Pembayar atau peserta harus merupakan anggota aktif grup ini.",
        },
      };
    }

    await db.transaction(async (tx) => {
      // 1. Update expense row
      await tx
        .update(expenses)
        .set({
          payerMemberId: data.payerMemberId,
          title: data.title,
          category: data.category,
          amount: targetAmount,
          spentAt: data.spentAt,
          splitMode: mode,
          note: data.note,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, data.expenseId));

      // 2. Replace splits
      await tx
        .delete(expenseSplits)
        .where(eq(expenseSplits.expenseId, data.expenseId));

      const splitRows = Object.entries(sharesMap)
        .filter(([, shareAmt]) => shareAmt > 0)
        .map(([mId, shareAmt]) => {
          const inputVal = inputValuesMap[mId] ?? 1;
          return {
            expenseId: data.expenseId,
            memberId: mId,
            inputValue: inputVal.toFixed(2),
            shareAmount: shareAmt,
          };
        });

      if (splitRows.length > 0) {
        await tx.insert(expenseSplits).values(splitRows);
      }

      // 3. Clean up and replace items / adjustments if items mode
      await tx
        .delete(expenseItems)
        .where(eq(expenseItems.expenseId, data.expenseId));
      await tx
        .delete(expenseAdjustments)
        .where(eq(expenseAdjustments.expenseId, data.expenseId));

      if (mode === "items" && data.items) {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          const [insertedItem] = await tx
            .insert(expenseItems)
            .values({
              expenseId: data.expenseId,
              name: item.name,
              amount: item.amount,
              position: idx,
            })
            .returning();

          const itemShareAmounts = alloc(item.amount, item.shares);
          const itemShareRows = Object.entries(item.shares).map(
            ([mId, porsi]) => ({
              itemId: insertedItem.id,
              memberId: mId,
              inputValue: porsi.toFixed(2),
              shareAmount: itemShareAmounts[mId] || 0,
            }),
          );

          if (itemShareRows.length > 0) {
            await tx.insert(expenseItemShares).values(itemShareRows);
          }
        }

        if (data.adjustments && data.adjustments.length > 0) {
          const adjRows = data.adjustments
            .filter((a) => a.amount > 0)
            .map((a) => ({
              expenseId: data.expenseId,
              kind: a.kind,
              amount: a.amount,
              allocation: a.allocation,
            }));
          if (adjRows.length > 0) {
            await tx.insert(expenseAdjustments).values(adjRows);
          }
        }
      }

      // Audit log
      await tx.insert(auditLogs).values({
        groupId: data.groupId,
        actorUserId: session.user.id,
        action: "expense.update",
        entity: "expense",
        entityId: data.expenseId,
        meta: { amount: targetAmount, title: data.title, mode },
        source: "user",
      });
    });

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath(`/groups/${data.groupId}/expenses`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui pengeluaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
): Promise<ActionResult<void>> {
  try {
    const { session, member: currentMember } = await requireMember(groupId);

    const existingExpense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
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

    if (
      existingExpense.createdByMemberId !== currentMember.id &&
      currentMember.role !== "owner"
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Hanya pembuat pengeluaran atau owner yang dapat menghapus pengeluaran ini.",
        },
      };
    }

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
        meta: {
          title: existingExpense.title,
          amount: existingExpense.amount,
        },
        source: "user",
      });
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/expenses`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus pengeluaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}
