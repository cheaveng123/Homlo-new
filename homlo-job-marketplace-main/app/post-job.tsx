import { Redirect } from "expo-router";

// The post-a-job experience now lives in the redesigned employer wizard at
// app/employer/post-job.tsx. This legacy root route is kept only so stale
// deep links to "/post-job" land on the current wizard instead of a removed form.
export default function LegacyPostJobScreen() {
  return <Redirect href={"/employer/post-job" as never} />;
}