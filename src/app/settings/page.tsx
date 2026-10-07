import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { SettingsClientView } from "./settings-client-view";

export default async function SettingsPage() {
  const session = await requireUser();

  // Fetch all active group memberships of the user, including payment methods
  const userMemberships = await db.query.members.findMany({
    where: and(
      eq(members.userId, session.user.id),
      isNull(members.leftAt),
    ),
    with: {
      group: true,
      paymentMethods: true,
    },
  });

  return (
    <SettingsClientView
      user={session.user}
      memberships={userMemberships}
    />
  );
}
