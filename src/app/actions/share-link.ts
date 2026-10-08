"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { shareLinks, auditLogs } from "@/lib/db/schema";
import { requireOwner, requireMember } from "@/lib/authz";
import { newShareToken } from "@/lib/share/token";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const createShareLinkSchema = z.object({
  groupId: z.string().uuid("ID grup tidak valid"),
  showDetails: z.boolean().default(false),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(30),
});

export async function createShareLink(
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    token: string;
    url: string;
    expiresAt: string;
    showDetails: boolean;
  }>
> {
  try {
    const rawShowDetails = formData.get("showDetails");
    const showDetails =
      rawShowDetails === "true" ||
      rawShowDetails === "1" ||
      rawShowDetails === "on";

    const parsed = createShareLinkSchema.safeParse({
      groupId: formData.get("groupId"),
      showDetails,
      expiresInDays: formData.get("expiresInDays") || 30,
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data tautan tidak valid",
        },
      };
    }

    const { groupId, showDetails: detailsEnabled, expiresInDays } = parsed.data;

    // Only owner can create public read-only links (FR-26)
    const { session } = await requireOwner(groupId);

    const { token, tokenHash } = newShareToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const [created] = await db.transaction(async (tx) => {
      const [link] = await tx
        .insert(shareLinks)
        .values({
          groupId,
          tokenHash,
          expiresAt,
          showDetails: detailsEnabled,
          createdBy: session.user.id,
        })
        .returning();

      await tx.insert(auditLogs).values({
        groupId,
        actorUserId: session.user.id,
        action: "share_link.create",
        entity: "share_link",
        entityId: link.id,
        meta: {
          showDetails: detailsEnabled,
          expiresInDays,
        },
        source: "user",
      });

      return [link];
    });

    revalidatePath(`/groups/${groupId}`);
    return {
      ok: true,
      data: {
        id: created.id,
        token,
        url: `/s/${token}`,
        expiresAt: created.expiresAt.toISOString(),
        showDetails: created.showDetails,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat tautan baca-saja";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

const revokeShareLinkSchema = z.object({
  shareLinkId: z.string().uuid("ID tautan tidak valid"),
  groupId: z.string().uuid("ID grup tidak valid"),
});

export async function revokeShareLink(
  formData: FormData,
): Promise<ActionResult<{ success: true }>> {
  try {
    const parsed = revokeShareLinkSchema.safeParse({
      shareLinkId: formData.get("shareLinkId"),
      groupId: formData.get("groupId"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Data pencabutan tidak valid",
        },
      };
    }

    const { shareLinkId, groupId } = parsed.data;

    // Only owner can revoke public read-only links
    const { session } = await requireOwner(groupId);

    const existing = await db.query.shareLinks.findFirst({
      where: and(eq(shareLinks.id, shareLinkId), eq(shareLinks.groupId, groupId)),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Tautan tidak ditemukan" },
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(eq(shareLinks.id, shareLinkId));

      await tx.insert(auditLogs).values({
        groupId,
        actorUserId: session.user.id,
        action: "share_link.revoke",
        entity: "share_link",
        entityId: shareLinkId,
        source: "user",
      });
    });

    revalidatePath(`/groups/${groupId}`);
    return { ok: true, data: { success: true } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mencabut tautan baca-saja";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}

export async function getGroupShareLinks(groupId: string) {
  await requireMember(groupId);

  const links = await db.query.shareLinks.findMany({
    where: eq(shareLinks.groupId, groupId),
    orderBy: [desc(shareLinks.createdAt)],
  });

  return links.map((l) => ({
    id: l.id,
    expiresAt: l.expiresAt.toISOString(),
    revokedAt: l.revokedAt ? l.revokedAt.toISOString() : null,
    showDetails: l.showDetails,
    viewCount: l.viewCount,
    createdAt: l.createdAt.toISOString(),
    isExpired: new Date(l.expiresAt).getTime() <= Date.now(),
    isActive: !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now(),
  }));
}
