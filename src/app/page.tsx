import { getSession } from "@/lib/authz";
import { LandingPageClientView } from "./landing-page-client";

export default async function HomePage() {
  const session = await getSession();

  return <LandingPageClientView isLoggedIn={Boolean(session)} />;
}
