import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { members, notificationPreferences } from "@/lib/db/schema";
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

  const pref = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, session.user.id),
  });

  const emailEnabled = pref ? pref.emailEnabled : true;

  return (
    <SettingsClientView
      user={session.user}
      memberships={userMemberships}
      emailEnabled={emailEnabled}
    />
  );
}
