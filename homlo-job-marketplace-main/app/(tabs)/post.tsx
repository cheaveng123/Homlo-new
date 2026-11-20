import EmployerDashboardNewAdapter from "@/screens/EmployerDashboardNewAdapter";

// The Post tab hosts the employer dashboard directly. It used to redirect to
// the /employer stack page, so every visit pushed a new screen over the tabs
// and coming back pushed a fresh copy of the tabs (everything remounted and
// reloaded). As a real tab it stays mounted like the others and uses the
// shared bottom bar. /employer and /employer/listings still work for links.
export default function PostTabScreen() {
  return <EmployerDashboardNewAdapter inTabs />;
}
