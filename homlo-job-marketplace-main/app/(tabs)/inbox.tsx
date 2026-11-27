import { useGlobalSearchParams } from "@/lib/router";

import InboxScreenNewAdapter from "@/screens/InboxScreenNewAdapter";

export default function InboxScreen() {
  const searchParams = useGlobalSearchParams() as { tab?: string };
  return <InboxScreenNewAdapter initialTab={searchParams.tab} />;
}
