import { Redirect } from "expo-router";

// Keep previous success and deep-link routes working while directing employers
// to the redesigned single listed-jobs management surface.
export default function EmployerJobsScreen() {
  return <Redirect href={"/employer" as never} />;
}
