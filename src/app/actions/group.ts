"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, members, invites, auditLogs } from "@/lib/db/schema";
import { requireUser, requireMember, requireOwner } from "@/lib/authz";
import { newInviteToken, hashToken } from "@/lib/invite-token";
import { joinRateLimiter, checkRateLimit } from "@/lib/ratelimit";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/* ==========================================================================
 * Group Schemas & Actions
 * ========================================================================== */

const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Isi nama grup")
    .max(100, "Nama grup maksimal 100 karakter"),
  description: z.string().max(255).optional(),
});

export async function createGroup(
  formData: FormData,
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const session = await requireUser();
    const parsed = createGroupSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data grup tidak valid",
        },
      };
    }

    // Atomic transaction: create group + add creator as owner member
    const newGroup = await db.transaction(async (tx) => {
      const [grp] = await tx
        .insert(groups)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          createdBy: session.user.id,
        })
        .returning();

      await tx.insert(members).values({
        groupId: grp.id,
        userId: session.user.id,
        displayName: session.user.name || "Owner",
        role: "owner",
      });

      await tx.insert(auditLogs).values({
        groupId: grp.id,
        actorUserId: session.user.id,
        action: "group.create",
        entity: "group",
        entityId: grp.id,
      });

      return grp;
    });

    revalidatePath("/groups");
    return { ok: true, data: { groupId: newGroup.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat grup";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

/* ==========================================================================
 * Invite Schemas & Actions
 * ========================================================================== */

const createInviteSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  role: z.enum(["owner", "member"]).default("member"),
  claimMemberId: z.string().uuid().optional(),
  maxUses: z.coerce.number().int().min(1).max(100).default(5),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export async function createInvite(
  formData: FormData,
): Promise<ActionResult<{ token: string; link: string; expiresAt: Date }>> {
  try {
    const parsed = createInviteSchema.safeParse({
      groupId: formData.get("groupId"),
      role: formData.get("role") || "member",
      claimMemberId: formData.get("claimMemberId") || undefined,
      maxUses: formData.get("maxUses") || 5,
      expiresInDays: formData.get("expiresInDays") || 7,
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data undangan tidak valid",
        },
      };
    }

    const { session } = await requireOwner(parsed.data.groupId);

    // If claimMemberId is provided, verify it belongs to this group
    if (parsed.data.claimMemberId) {
      const targetMember = await db.query.members.findFirst({
        where: and(
          eq(members.id, parsed.data.claimMemberId),
          eq(members.groupId, parsed.data.groupId),
          isNull(members.leftAt),
        ),
      });

      if (!targetMember) {
        return {
          ok: false,
          error: {
            code: "MEMBER_NOT_FOUND",
            message: "Anggota yang akan diklaim tidak ditemukan dalam grup ini",
          },
        };
      }
    }

    const { token, tokenHash } = newInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

    await db.insert(invites).values({
      groupId: parsed.data.groupId,
      tokenHash,
      role: parsed.data.role,
      claimMemberId: parsed.data.claimMemberId,
      expiresAt,
      maxUses: parsed.data.maxUses,
      createdBy: session.user.id,
    });

    revalidatePath(`/groups/${parsed.data.groupId}/members`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl}/join/${token}`;

    return {
      ok: true,
      data: { token, link, expiresAt },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat undangan";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function revokeInvite(
  groupId: string,
  inviteId: string,
): Promise<ActionResult<void>> {
  try {
    await requireOwner(groupId);

    await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, inviteId), eq(invites.groupId, groupId)));

    revalidatePath(`/groups/${groupId}/members`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mencabut undangan";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const session = await requireUser();

    // Check rate limit per user
    const rateCheck = await checkRateLimit(joinRateLimiter, session.user.id);
    if (!rateCheck.success) {
      return {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Terlalu banyak mencoba bergabung. Harap tunggu beberapa saat.",
        },
      };
    }

    const tHash = hashToken(token);

    // First check if invite exists at all
    const existingInvite = await db.query.invites.findFirst({
      where: eq(invites.tokenHash, tHash),
    });

    if (!existingInvite) {
      return {
        ok: false,
        error: {
          code: "INVITE_INVALID",
          message: "Link undangan tidak valid atau tidak ditemukan.",
        },
      };
    }

    // Check if user is already an active member of this group
    const alreadyMember = await db.query.members.findFirst({
      where: and(
        eq(members.groupId, existingInvite.groupId),
        eq(members.userId, session.user.id),
        isNull(members.leftAt),
      ),
    });

    if (alreadyMember) {
      // Don't consume quota if user is already a member
      return { ok: true, data: { groupId: existingInvite.groupId } };
    }

    // Atomic quota consumption with transactional membership creation
    const resultGroupId = await db.transaction(async (tx) => {
      const [inv] = await tx
        .update(invites)
        .set({ usedCount: sql`${invites.usedCount} + 1` })
        .where(
          and(
            eq(invites.tokenHash, tHash),
            isNull(invites.revokedAt),
            sql`${invites.expiresAt} > NOW()`,
            sql`${invites.usedCount} < ${invites.maxUses}`,
          ),
        )
        .returning();

      if (!inv) {
        throw new Error("Link undangan sudah kedaluwarsa, dicabut, atau kuotanya habis.");
      }

      // Check if this invite is linked to claim a placeholder member
      if (inv.claimMemberId) {
        const targetMember = await tx.query.members.findFirst({
          where: and(
            eq(members.id, inv.claimMemberId),
            eq(members.groupId, inv.groupId),
          ),
        });

        if (targetMember && !targetMember.userId) {
          // Claim profile
          await tx
            .update(members)
            .set({ userId: session.user.id })
            .where(eq(members.id, targetMember.id));
          return inv.groupId;
        }
      }

      // Otherwise create a new member
      await tx.insert(members).values({
        groupId: inv.groupId,
        userId: session.user.id,
        displayName: session.user.name || "Anggota Baru",
        role: inv.role,
      });

      return inv.groupId;
    });

    revalidatePath(`/groups/${resultGroupId}`);
    return { ok: true, data: { groupId: resultGroupId } };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Link undangan tidak berlaku atau kuota telah habis";
    return { ok: false, error: { code: "INVITE_INVALID", message } };
  }
}

/* ==========================================================================
 * Member Management Actions
 * ========================================================================== */

const addPlaceholderSchema = z.object({
  groupId: z.string().uuid(),
  displayName: z
    .string()
    .min(1, "Isi nama anggota")
    .max(50, "Nama maksimal 50 karakter"),
});

export async function addPlaceholderMember(
  formData: FormData,
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = addPlaceholderSchema.safeParse({
      groupId: formData.get("groupId"),
      displayName: formData.get("displayName"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Nama anggota tidak valid",
        },
      };
    }

    await requireOwner(parsed.data.groupId);

    const [newMem] = await db
      .insert(members)
      .values({
        groupId: parsed.data.groupId,
        userId: null,
        displayName: parsed.data.displayName,
        role: "member",
      })
      .returning();

    revalidatePath(`/groups/${parsed.data.groupId}/members`);
    return { ok: true, data: { memberId: newMem.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah anggota";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function updateMemberRole(
  groupId: string,
  targetMemberId: string,
  newRole: "owner" | "member",
): Promise<ActionResult<void>> {
  try {
    await requireOwner(groupId);

    // If downgrading to member, ensure there's at least one other active owner
    if (newRole === "member") {
      const activeOwners = await db.query.members.findMany({
        where: and(
          eq(members.groupId, groupId),
          eq(members.role, "owner"),
          isNull(members.leftAt),
        ),
      });

      if (activeOwners.length <= 1 && activeOwners[0]?.id === targetMemberId) {
        return {
          ok: false,
          error: {
            code: "LAST_OWNER",
            message: "Tidak dapat menurunkan owner terakhir. Tunjuk owner lain terlebih dahulu.",
          },
        };
      }
    }

    await db
      .update(members)
      .set({ role: newRole })
      .where(and(eq(members.id, targetMemberId), eq(members.groupId, groupId)));

    revalidatePath(`/groups/${groupId}/members`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah peran anggota";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function removeMember(
  groupId: string,
  targetMemberId: string,
): Promise<ActionResult<void>> {
  try {
    await requireOwner(groupId);

    // In a future phase, check target member balance if not force.
    // Soft leave:
    await db
      .update(members)
      .set({ leftAt: new Date() })
      .where(and(eq(members.id, targetMemberId), eq(members.groupId, groupId)));

    revalidatePath(`/groups/${groupId}/members`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengeluarkan anggota";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function leaveGroup(groupId: string): Promise<ActionResult<void>> {
  try {
    const { member } = await requireMember(groupId);

    // If owner, verify not the sole active owner
    if (member.role === "owner") {
      const activeOwners = await db.query.members.findMany({
        where: and(
          eq(members.groupId, groupId),
          eq(members.role, "owner"),
          isNull(members.leftAt),
        ),
      });

      if (activeOwners.length <= 1) {
        return {
          ok: false,
          error: {
            code: "SOLE_OWNER",
            message: "Sebagai satu-satunya owner, tunjuk owner pengganti sebelum keluar dari grup.",
          },
        };
      }
    }

    // Soft leave
    await db
      .update(members)
      .set({ leftAt: new Date() })
      .where(eq(members.id, member.id));

    revalidatePath("/groups");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal keluar dari grup";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}
