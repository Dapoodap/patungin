"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { requireUser } from "@/lib/authz";
import type { ActionResult } from "./group";

export async function updateEmailReminderPreference(
  enabled: boolean,
): Promise<ActionResult<{ emailEnabled: boolean }>> {
  try {
    const session = await requireUser();

    const existing = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, session.user.id),
    });

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({
          emailEnabled: enabled,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, session.user.id));
    } else {
      await db.insert(notificationPreferences).values({
        userId: session.user.id,
        emailEnabled: enabled,
      });
    }

    revalidatePath("/settings");
    return { ok: true, data: { emailEnabled: enabled } };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal memperbarui preferensi notifikasi";
    return { ok: false, error: { code: "SERVER_ERROR", message } };
  }
}
