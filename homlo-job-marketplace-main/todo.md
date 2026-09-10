# Project TODO

- [x] Establish Homlo Jobs visual tokens and a native-style tab layout
- [x] Build the Home job-discovery screen based on the supplied reference
- [x] Add browse/search jobs with category filtering and job-detail navigation
- [x] Add locally persisted saved-job state and Saved tab
- [x] Add the Profile screen and useful feedback states
- [x] Generate and configure unique Homlo Jobs icon assets
- [x] Add automated behavior checks and run TypeScript validation
- [x] Verify the primary flows with deterministic unit, type, and lint checks
- [x] Research tangible visual and interaction patterns that make mobile interfaces feel authored rather than generic
- [x] Reduce the upper home-screen scale and improve the compact visual rhythm
- [x] Add restrained, accessible entrance and interaction motion to the discovery experience
- [x] Replace the basic apply alert with a polished application preparation detail screen
- [x] Validate the visual and interaction refinements with automated checks
- [x] Add a centralized Expo-compatible professional typeface and typography scale across the mobile app
- [x] Transform the Home search element from its hero form into a reversible scroll-driven floating search control
- [x] Preserve safe-area spacing, smooth UI-thread motion, and existing Home search behavior during the transformation
- [x] Apply the updated typography hierarchy across Home, Jobs, Saved, Profile, job detail, and application flows
- [x] Validate the motion and typography update with type, lint, and behavioral checks
- [x] Add a branded, scroll-responsive job-detail banner with subtle parallax and compact-header interpolation
- [x] Redesign the job-detail bottom action into a permanently available, safe-area-aware floating apply surface
- [x] Add relationship-appropriate navigation transitions for job detail and the application workflow
- [x] Standardize the primary button, saved-state, and control micro-interactions with restrained haptics and press feedback
- [x] Validate the job-detail visual, motion, and application-flow refinements
- [x] Create structured category and opportunity data that can later be sourced from a backend
- [x] Add working category-result navigation with preselected search/filter context
- [x] Redesign the Home content below nearby jobs into varied editorial category and discovery sections
- [x] Add a central plus-tab post-job action without disrupting the existing primary navigation
- [x] Build a polished multi-step employer Post a Job workflow with draft review and confirmation states
- [x] Validate the expanded Home discovery and employer posting flows
- [x] Expand the local marketplace data with a richer unique job catalog and reusable listing metadata
- [x] Redesign the reusable job container around title, company, salary, location, employment type, posted time, and saving
- [x] Replace the category-heavy lower Home content with a long job-first marketplace feed organized by small category labels
- [x] Strengthen the job-detail information block below the animated banner without altering banner behavior or floating apply access
- [x] Validate the job-first feed, listing detail, and existing posting flows
- [x] Add specialized discovery pages for Part-time, Internships, Weekend, and Remote searches
- [x] Add relevant search, location, pay, work-type, experience, and sorting controls to the specialized result pages
- [x] Route Home quick-search choices to dedicated discovery pages instead of the generic jobs page
- [x] Rework the Home search transformation so the hero scrolls naturally and only morphs near the top without sticking
- [x] Validate the dedicated discovery flows and revised Home scroll transition
- [x] Make the Home Explore Opportunities control fully rounded and prevent clipping during the search morph
- [x] Elevate the transforming Home search surface above quick-search and all scrolling feed content
- [x] Validate the Home search geometry and outermost-layer behavior
- [x] Pin the transformed Home search bar safely below the device top until the hero returns to its original position
- [x] Build a required four-step guided search flow for salary, work type, field, and city selection
- [x] Add a virtual city map selector with clear selected-city feedback
- [x] Route guided-search answers into a dedicated matched-results page with adjustable filters
- [x] Validate pinned search behavior and the guided search journey
- [x] Lower the pinned Home compact search below device-island safe areas
- [x] Replace guided salary choices with a horizontally scrollable selection rail
- [x] Replace city chips with an interactive virtual map and adjustable search radius
- [x] Resolve selected map areas to nearby city matches for guided job results
- [x] Validate the safe-area, salary rail, and map-radius flows
- [x] Replace the simulated map picker with a real OpenStreetMap-based interactive map and location search
- [x] Add current-location support with a Phnom Penh default and confirmed map selection
- [x] Replace salary choices with a touch-friendly dual-handle minimum/maximum range slider
- [x] Resolve map-selected areas into nearby-job filtering without hardcoded map markers
- [x] Trigger and pin the Home search transformation from the Explore Opportunities action position below the header
- [x] Validate real map, range slider, and position-based morph interactions
- [x] Inspect and fix all current application runtime, build, and configuration errors
- [x] Revalidate the repaired mobile app across unit tests, types, and lint
- [x] Research professional mobile transition patterns and document applied decisions
- [x] Make the Job Detail banner full-bleed through the device top safe area
- [x] Expand the Job Detail Apply Now action into a more balanced professional primary surface
- [x] Add permission-aware Select current location control to the Home search location area
- [x] Apply research-led navigation transition refinements across key flows
- [x] Validate the visual, location-permission, and transition refinements
- [x] Inspect and fix the newly reported application runtime or build error
- [x] Revalidate the repaired app runtime, types, tests, and lint
- [x] Create a distinct post-search results detail experience with clear option labels and actions
- [x] Replace the bottom Saved destination with a functional Inbox destination
- [x] Route Explore Opportunities to a unique editorial all-opportunities page rather than generic search
- [x] Add an employer hub before posting, with routes to listed jobs and new listing creation
- [x] Convert the existing post-job flow from a modal to a full-screen experience
- [x] Validate the new discovery, inbox, employer, and posting journeys
- [x] Diagnose and fix the reported black-screen rendering issue without masking its root cause
- [x] Apply the attached neutral Homlo visual system across Explore, results, employer, and Inbox routes
- [x] Rebuild Explore Opportunities as a compact marketplace discovery feed with search and filter-sheet controls
- [x] Align Search Results to the canonical Home job card with compact search context and robust result states
- [x] Rework the employer landing screen around listed jobs and a clear new-listing entry action
- [x] Refine Inbox into a practical marketplace message and notification feed with truthful empty messaging state
- [x] Validate the redesigned routes, light-mode rendering, and route-level build output
- [x] Center and enlarge the Job Detail floating Apply Now action with more rounded, readable styling
- [x] Replace crowded multi-option selectors with larger dropdown-style controls where appropriate
- [x] Validate the refined detail action and selector interactions
- [x] Audit the existing authentication architecture and implement only supported functional login/session behavior
- [x] Use the existing functional secure OAuth entry instead of unsupported Google or Apple provider buttons
- [x] Create the requested concise Homlo authentication entry and reliable sign-out return flow
- [x] Redesign Profile as a data-supported job-seeker identity and career surface without inventing user details
- [x] Refine the application-detail journey with clear progress, truthful user data, and professional states
- [x] Validate authentication entry, protected navigation, profile, and application routes
- [x] Convert the authentication entry to a polished UI-only screen without live sign-in behavior
- [x] Simplify the Profile visual hierarchy with restrained neutral surfaces and reduced color emphasis
- [x] Validate the refined account-entry and Profile presentation
- [x] Diagnose the reported blank Home and non-login route regression
- [x] Restore full Home and core application content while keeping UI-only work isolated to Login
- [x] Validate rendered Home, Jobs, Explore, and Profile routes after the restoration
- [x] Add restrained animated job-card skeleton loading to Home and Explore while their listings initialize
- [x] Verify and preserve the simplified neutral Profile design
- [x] Complete the UI-only Apple and Google sign-in presentation with clear visual feedback
- [x] Standardize concise page-transition motion across all registered app routes
- [x] Validate loading, Profile, login, and transition refinements
- [x] Open the UI-only Login screen when an unauthenticated user attempts to submit an application
- [x] Require a deliberate horizontal edge swipe for back navigation so ordinary scrolling does not navigate away
- [x] Research and apply professional mobile hierarchy and emphasis refinements across key screens
- [x] Validate application access, gesture handling, and redesigned visual hierarchy
- [x] Give the application sign-in prompt a clear dismissal and back-to-job recovery path
- [x] Make UI-only Apple and Google actions enter a temporary signed-in build state
- [x] Slow the Job Detail banner collapse and related content transition for a more deliberate feel
- [x] Validate prompt dismissal, temporary provider entry, and Job Detail motion
- [x] Research Airbnb typography, icon-system conventions, and authored mobile interface patterns
- [x] Redesign Profile using the supplied reference only as a framework for hierarchy and progress presentation
- [x] Refine Home quick-search typography and iconography with a consistent professional system
- [x] Reduce generic container styling across primary components without removing working discovery flows
- [x] Add an explicit back action to the post-job journey
- [x] Validate the redesigned Profile, quick search, post-job navigation, and primary routes
- [x] Align the Job Detail hero image with the full-width Apply Detail treatment while preserving overlay controls
- [x] Consolidate primary, action, deep-green, neutral, and semantic color usage around the supplied Homlo palette
- [x] Apply the palette consistently to navigation, buttons, cards, search/filter surfaces, Profile, Inbox, Apply, and Post Job
- [x] Verify the refined core routes and preserve existing functionality

- [x] Rework Apply Detail into a reference-led step-flow screen with a stronger hero and progress structure
- [x] Rebuild Explore/Search as the illustrated-category and popular-search framework shown in the reference
- [x] Reframe Search Results with the reference’s compact header and dense listing rhythm
- [x] Redesign Profile around a reference-inspired identity header, completion card, and editable sections
- [x] Add a visible back/close control to the Apply Detail route and restore Job Detail after Apply
- [x] Validate the redesigned routes, Apply navigation recovery, and existing marketplace flows

- [x] Redo the reference-led Apply Detail redesign using the established Homlo visual model instead of the prior patch treatment
- [x] Redo Explore/Search and Search Results with closer reference structure, spacing, and authored content density
- [x] Redo Profile with a more faithful reference-inspired identity and progress framework
- [x] Revalidate Apply back/exit recovery and preserve existing marketplace flows

- [x] Reduce Apply Detail hero and content scale so the screen feels zoomed out and the Back control is easy to press
- [x] Refine Profile spacing and visual scale for a calmer, more usable presentation
- [x] Validate Apply Back interaction and the focused Profile route without changing other flows

- [x] Add balanced horizontal inset to Apply Detail content while preserving the full-width hero and action bar
- [x] Validate Apply Detail spacing at mobile width and preserve Back/navigation behavior

- [x] Redesign Explore/Search with the reference’s light hero backdrop, concise title, prominent search/filter row, and compact categories
- [x] Refine Search result count, sorting, and canonical job-card density to match the reference rhythm
- [x] Align Search bottom navigation styling with the clean five-item reference hotbar without changing routes
- [x] Validate Search filters, sorting, save behavior, job navigation, and mobile layout

- [x] Diagnose and fix the currently reported Explore/Search errors
- [x] Add a smooth slide-in animation to the existing filter menu while preserving filter state and controls
- [x] Validate the repaired Search route, filter interaction, and full app build

- [x] Rebuild the visible Search page so its rendered composition clearly follows the supplied reference
- [x] Add horizontal inset to the Apply title and back control and remove the unwanted top white container
- [x] Repair back navigation across listing and detail routes so returning does not duplicate pages
- [x] Validate Search, Apply Detail, listing detail, and route-stack recovery

- [x] Fix Apply Detail Back so it returns to the existing Job Detail route without replaying or duplicating the page
- [x] Route Home quick-search categories such as Part-time and Internship to dedicated result pages
- [x] Extend the Search green hero through the device top and add a smooth green-to-white visual transition
- [x] Validate Apply recovery, quick-search destinations, and Search rendering

- [x] Add a device document-picker CV attachment option to Apply Detail with cancel and selected-file states
- [x] Redesign dedicated category-result pages to match the supplied compact reference listing layout
- [x] Move the existing discovery filters into the category-result filter button and preserve filter behavior
- [x] Strengthen the Search page top header typography and hierarchy
- [x] Validate Apply CV selection, category-result routing, filters, and Search typography

- [x] Read and implement the newly attached user-provided prompt, including its requested interface and behavior changes

- [x] Add first-launch onboarding flow with work type, location, availability, experience, and completion screens
- [x] Route completed or skipped onboarding into the UI-only authentication page and persist completion state
- [x] Add employer Boost entry action to every listed-job container
- [x] Build Boost overview, options, plan selection, plan details, payment selection, and activation confirmation screens
- [x] Persist local Boost activation and selected plan state for employer listings
- [x] Validate onboarding routing, auth handoff, Boost flow, and mobile rendering

- [x] Replace onboarding location placeholder with a real interactive Google Maps-compatible map and selectable location state
- [x] Add polished containers to the onboarding availability step
- [x] Make the final onboarding step a login page with a reliable Home return path
- [x] Validate map rendering, onboarding navigation, login handoff, and Home recovery

- [x] Restore a clear first-launch onboarding entry and safe onboarding reset behavior
- [x] Show the selected employer job’s complete listing context throughout the Boost flow
- [x] Add a glowing green Boost Activated confirmation with a letter mark and surrounding rings
- [x] Make Boost completion return once without duplicating the previous route
- [x] Restore full job information in employer listed-job rows beside the Boost button
- [x] Validate onboarding visibility, Boost activation, back navigation, and employer listing rendering

- [x] Fix onboarding Continue so it completes once and routes directly to Login without returning to the first step
- [x] Rebalance spacing and bottom actions on the later onboarding steps for compact devices
- [x] Validate onboarding completion, Login entry, restart prevention, and late-step layouts

- [x] Connect persisted onboarding preferences to Home recommendation filtering
- [x] Add a smooth fade transition from final onboarding step into Login
- [x] Keep complete selected-job information visible across every Boost plan and payment screen
- [x] Validate recommendation filtering, Login transition, Boost context, and build output

- [x] Lower the Boost page content so its Back control remains reachable below the device safe area
- [x] Restore the employer listed-jobs row design with complete job information and Boost aligned at the far right
- [x] Clear onboarding completion on Logout so onboarding reappears for review
- [x] Normalize back navigation transitions to avoid unexpected replay animations
- [x] Validate Boost reachability, employer rows, logout onboarding review, and back motion

- [x] Remove Upgrade Account from the homepage header and expose only the profile icon
- [x] Add animated profile dropdown with Settings, Upgrade Account, and confirmed Log Out actions
- [x] Add a separate Account Plans page for Free, Pro, and Enterprise tiers
- [x] Keep Account Plans separate from per-job Boosting
- [x] Apply exact Free and Pro Boost prices and visibly show the Pro monthly Standard Boost benefit
- [x] Add expandable Boost feature details before any activation or purchase action
- [x] Add Enterprise custom hiring campaign budget slider and estimate sections
- [x] Add consistent professional icons and remove emoji-style symbols from affected UI
- [x] Add payment method selection without accidental immediate purchase or activation
- [x] Preserve existing text placement, button alignment, spacing, and unrelated screens
- [x] Validate account navigation, plan routes, Boost flows, payment states, icons, and responsive layouts

- [x] Redesign listed-job containers so job name and details are visible above the far-right Boost action
- [x] Add a dedicated Pro account checkout screen after Upgrade to Pro
- [x] Add a dedicated Boost checkout screen that preserves the selected job and plan
- [x] Fix Boost first-open safe-area spacing so no content starts above the device viewport
- [x] Validate listed-job row hierarchy, checkout routes, payment states, and compact-device Boost layout

- [x] Increase spacing between onboarding availability buttons and their labels
- [x] Widen and rebalance the final onboarding Login handoff actions
- [x] Rebuild Boost listed-job entries with job image, name, details, and right-side Boost action
- [x] Lower the Boost Back control so it stays reachable below the device top safe area
- [x] Repair final Post a Job success actions so buttons fit the screen and use balanced sizing
- [x] Validate affected layouts and run regression checks at compact mobile width

- [x] Prevent Search page top option cards from clipping at the viewport edge
- [x] Increase internal horizontal padding for Filter Jobs and Show Results controls
- [x] Keep employer-defined job names visible in listing cards and pin Boost to the far-right edge
- [x] Persist and display a glowing Boosted state on the exact employer listing after completion
- [x] Stabilize first-open Boost positioning below the device safe area
- [x] Extend related detail-page top backgrounds through the device safe area
- [x] Validate Search, employer listing, Boost completion, detail headers, and button spacing

- [x] Anchor the employer Boost action 10px from the listing card's right edge
- [x] Keep the Boost progress bar and Back control below the first-open device safe area
- [x] Return Boost completion to the actual full Listed Jobs route, not a mini or modal surface
- [x] Make the Search bottom hot bar match the Home hot bar structure and spacing
- [x] Validate card edge alignment, Boost first-open navigation, completion routing, and hot-bar parity

- [x] Refactor employer job rows into responsive job-information and far-right Boost-action columns
- [x] Preserve each selected employer job’s actual ID and metadata through every Boost step
- [x] Refactor Boost initial layout so the progress, title, job context, and controls begin visibly below the safe area
- [x] Rework Boost success return to use only the existing full Job Management route
- [x] Rebuild category-search headers as a white safe-area section with accessible title, filters, and results
- [x] Remove layout behavior that shifts affected page content underneath top UI
- [x] Test the complete Boost selection-to-return flow and all category search pages on compact mobile heights

- [x] Rebuild the employer listed-job card with title-first hierarchy and a far-right Boost action
- [x] Persist the completed Boost state and navigate Go Home to the real Home route without overlays
- [x] Remove the extra green artifact above Search bottom navigation
- [x] Guard rapid tab switches and remove redundant Search loading on entry
- [x] Validate employer card hierarchy, Boost-to-Home routing, Search hot bar, and fast tab navigation

- [x] Validate the supplied Supabase/Postgres migration specifications against the current Homlo backend
- [x] Configure secure Supabase environment variables and preserve backend-only secrets
- [x] Create provider-agnostic database, storage, auth, payment, and repository foundations
- [x] Add version-controlled migrations for identity, profiles, categories, jobs, and job media
- [x] Add scalable repositories and services for applications, messaging, saved jobs, notifications, and reviews
- [x] Add webhook-verified payments, Boost persistence, moderation reports, and append-only audit logs
- [x] Expose server-side procedures and connect core Homlo flows without frontend Supabase access
- [x] Apply migrations and validate security boundaries, idempotency, and transaction behavior
- [x] Run integration, mobile export, and regression checks for the Supabase backend migration
- [ ] Replace the invalid direct Postgres URI and complete the transactional Supabase server cutover

- [x] Remove the temporary UI-only login provider simulation
- [x] Remove temporary local authentication state created only for UI review
- [x] Preserve onboarding handoff, logout reset, and backend-ready protected-route boundaries
- [x] Validate authentication entry removal and all affected mobile navigation routes

- [ ] Configure the server-only Supabase Postgres connection and production authentication redirect
- [x] Add production Supabase Auth sign-up/sign-in and server-side token verification
- [x] Resolve authenticated users into canonical Homlo users and require first-login profile completion
- [x] Expose authenticated application and employer procedures through the provider-agnostic service layer
- [x] Replace the staged login surface with real production authentication UI
- [x] Connect mobile application submission and employer job management to Supabase-backed APIs
- [x] Validate secure authentication, account creation, profile setup, application, and employer workflows

- [x] Configure the direct Supabase integration as the transaction-capable production server boundary

- [x] Restore onboarding-first launch behavior and bypass sign-in for already authenticated users
- [x] Add a confirmed employer job deletion action backed by protected Supabase service removal
- [x] Validate launch routing and database-backed deletion behavior

- [x] Show every published job in Home, Search, and search-results feeds
- [x] Persist and restore authenticated Supabase sessions across app launches without repeated sign-in
- [x] Keep successful application submission on the application page with a clear completion state
- [x] Replace Explore Opportunities with a rounded typewriter search suggestion bar
- [x] Validate discovery data, session restoration, application completion, search animation, and mobile export

2026-08-28 request: unify published-job discovery, fix repeated login, keep application completion on Apply, and replace Explore Opportunities with a typewriter search bar.

2026-08-28 implementation note: inspect and preserve the existing visual system and server-only Supabase boundary while making these changes.

2026-08-28 acceptance criteria: published Supabase jobs render in all three discovery surfaces; restored valid sessions bypass login; successful Apply remains on the application route; search placeholder animates through suggestions without layout shift.


## Attached master prompt — 2026-08-28

- [ ] Repair active-job Apply navigation and add status notification delivery
- [ ] Fix Saved Jobs persistence, reconciliation, and visible error states
- [ ] Replace unstructured application fields with validated structured controls and map picker
- [ ] Add pure weighted smart-search ranking across price, distance, and preference matches
- [ ] Validate Apply, notifications, Saved Jobs, structured form, smart search, and Expo export


## Expo Go SDK 54 compatibility prompt — 2026-08-28

- [x] Audit Expo SDK and Expo-adjacent dependency alignment and native-build requirements
- [x] Ensure the managed project has no custom native folders, dev-client-only packages, or required prebuild path
- [x] Update README with exact Expo Go 54 setup steps and safe environment guidance
- [x] Run expo-doctor, TypeScript/tests, and npx expo start validation
