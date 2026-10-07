"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentMethods, members } from "@/lib/db/schema";
import { requireUser } from "@/lib/authz";
import type { ActionResult } from "./group";

/* ==========================================================================
 * Schemas
 * ========================================================================== */

const addPaymentMethodSchema = z.object({
  memberId: z.string().uuid("ID anggota tidak valid"),
  type: z.enum(
    ["gopay", "shopeepay", "dana", "ovo", "bank", "qris", "other"],
    { message: "Pilih jenis pembayaran" },
  ),
  label: z
    .string()
    .min(1, "Label harus diisi")
    .max(100, "Label maksimal 100 karakter"),
  value: z
    .string()
    .min(1, "Nomor/identitas harus diisi")
    .max(200, "Nomor maksimal 200 karakter"),
});

/* ==========================================================================
 * Actions
 * ========================================================================== */

export async function addPaymentMethod(
  payload: z.infer<typeof addPaymentMethodSchema>,
): Promise<ActionResult<{ paymentMethodId: string }>> {
  try {
    const parsed = addPaymentMethodSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ||
            "Data metode pembayaran tidak valid",
        },
      };
    }

    const { data } = parsed;
    const session = await requireUser();

    // Verify the member belongs to the current user
    const member = await db.query.members.findFirst({
      where: and(
        eq(members.id, data.memberId),
        eq(members.userId, session.user.id),
      ),
    });

    if (!member) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Anda hanya dapat menambah metode pembayaran untuk diri sendiri.",
        },
      };
    }

    const [pm] = await db
      .insert(paymentMethods)
      .values({
        memberId: data.memberId,
        type: data.type,
        label: data.label,
        value: data.value,
      })
      .returning();

    revalidatePath("/settings");
    return { ok: true, data: { paymentMethodId: pm.id } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menambah metode pembayaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function deletePaymentMethod(
  paymentMethodId: string,
): Promise<ActionResult<void>> {
  try {
    const session = await requireUser();

    // Find the payment method and verify ownership
    const pm = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, paymentMethodId),
      with: { member: true },
    });

    if (!pm) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Metode pembayaran tidak ditemukan",
        },
      };
    }

    // Check the member is owned by this user
    const member = await db.query.members.findFirst({
      where: and(
        eq(members.id, pm.memberId),
        eq(members.userId, session.user.id),
      ),
    });

    if (!member) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Anda hanya dapat menghapus metode pembayaran milik Anda sendiri.",
        },
      };
    }

    await db
      .delete(paymentMethods)
      .where(eq(paymentMethods.id, paymentMethodId));

    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal menghapus metode pembayaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

const addPaymentMethodForUserSchema = z.object({
  type: z.enum(
    ["gopay", "shopeepay", "dana", "ovo", "bank", "qris", "other"],
    { message: "Pilih jenis pembayaran" },
  ),
  label: z
    .string()
    .min(1, "Label harus diisi")
    .max(100, "Label maksimal 100 karakter"),
  value: z
    .string()
    .min(1, "Nomor/identitas harus diisi")
    .max(200, "Nomor maksimal 200 karakter"),
  targetMemberId: z.string().uuid().optional(),
});

/**
 * Add payment method for the current user across their active memberships,
 * or for a specific member ID.
 */
export async function addPaymentMethodForUser(
  payload: z.infer<typeof addPaymentMethodForUserSchema>,
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await requireUser();
    const parsed = addPaymentMethodForUserSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ||
            "Data metode pembayaran tidak valid",
        },
      };
    }

    const { data } = parsed;

    // Find all active memberships of this user
    let userMembers = await db.query.members.findMany({
      where: and(
        eq(members.userId, session.user.id),
        isNull(members.leftAt),
      ),
    });

    if (data.targetMemberId) {
      userMembers = userMembers.filter((m) => m.id === data.targetMemberId);
    }

    if (userMembers.length === 0) {
      return {
        ok: false,
        error: {
          code: "NO_ACTIVE_GROUPS",
          message:
            "Kamu belum bergabung di grup mana pun. Gabung atau buat grup terlebih dahulu.",
        },
      };
    }

    // Insert for each target membership
    for (const mem of userMembers) {
      await db.insert(paymentMethods).values({
        memberId: mem.id,
        type: data.type,
        label: data.label,
        value: data.value,
      });
    }

    revalidatePath("/settings");
    return { ok: true, data: { count: userMembers.length } };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal menyimpan metode pembayaran";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

