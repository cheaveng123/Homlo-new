import { Redirect } from "@/lib/router";

// The employer "post a job" home is now the new listings dashboard at
// app/employer/listings.tsx (Live/Draft/Review tabs). This legacy root route
// is kept only so the Post tab, home links and deep links to "/employer" land
// on the current design instead of the retired Listed Jobs hub.
export default function EmployerHubScreen() {
  return <Redirect href={"/employer/listings" as never} />;
}