import EmployerDashboardNewAdapter from "@/screens/EmployerDashboardNewAdapter";

// The green header/dashboard is now the redesigned PostDashboardScreenNew via
// EmployerDashboardNewAdapter, which re-hosts the app's bottom tab bar, the
// Live/Draft/Review tabs, stat-tile navigation and the job action sheet on top
// of the real gateway data (homlo.employer.jobs + useEmployerApplications).
// This route stays thin, matching the repo convention.
export default function EmployerListingsDashboard() {
  return <EmployerDashboardNewAdapter />;
}