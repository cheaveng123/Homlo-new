/**
 * App Store safety switch for demo / mock content.
 *
 * The app ships hand-written sample data (lib/mock/*): sample employers with
 * star ratings and reviews, sample job listings, and a generic placeholder job
 * for unknown ids. Showing that to real users is fake content (App Review
 * guideline 2.3 / 5.6 — fake reviews get apps removed), and it made deleted
 * jobs look like they still existed.
 *
 * It is OFF unless explicitly enabled for local design work:
 *   EXPO_PUBLIC_DEMO_CONTENT=true
 * Never set this in a TestFlight or App Store build.
 */
export const DEMO_CONTENT_ENABLED = process.env.EXPO_PUBLIC_DEMO_CONTENT === "true";
