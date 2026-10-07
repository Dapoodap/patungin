import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";

export class ForbiddenError extends Error {
  constructor(message = "Aksi tidak diizinkan untuk peran Anda") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class InviteInvalidError extends Error {
  constructor(message = "Link undangan tidak berlaku atau kuota telah habis") {
    super(message);
    this.name = "InviteInvalidError";
  }
}

/**
 * Get current session from Better Auth.
 */
export async function getSession() {
  const reqHeaders = await headers();
  return auth.api.getSession({
    headers: reqHeaders,
  });
}

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Wajib anggota aktif grup. Bukan anggota -> 404 agar keberadaan grup tidak bocor.
 */
export async function requireMember(groupId: string) {
  const session = await requireUser();
  const member = await db.query.members.findFirst({
    where: and(
      eq(members.groupId, groupId),
      eq(members.userId, session.user.id),
      isNull(members.leftAt),
    ),
  });

  if (!member) {
    notFound();
  }

  return { session, member };
}

/**
 * Wajib owner aktif grup. Bukan owner -> ForbiddenError.
 */
export async function requireOwner(groupId: string) {
  const ctx = await requireMember(groupId);
  if (ctx.member.role !== "owner") {
    throw new ForbiddenError("Hanya owner grup yang dapat melakukan aksi ini");
  }
  return ctx;
}
