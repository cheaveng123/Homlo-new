# Validation Notes

The compact mobile Search route renders with the full-width pale-green hero reaching the top of the viewport, category icons, popular-search rows, and loading skeletons. The Job Detail route renders normally. The nested `/job/restaurant-server/apply` route is still stuck on the Expo web “Bundling… app/job/[id]/apply.tsx” screen during direct preview capture, although `pnpm check`, `pnpm lint`, `pnpm test`, and `expo export --platform web` complete successfully and include the `/job/[id]/apply` static route. Metro logs show a stale asset request error for `/home/ubuntu/homlo-job-marketplace/images`, not a TypeScript or bundle compile error.

## Current visual finding

The compact discovery layout and CV card render, but the first cold preview capture shows serif fallback text across the dedicated discovery, Apply, and Search routes. Recheck after the font bundle warms and inspect the shared text/font-loading setup before checkpointing; the intended design uses the app’s Inter family, not browser default serif fallback.

## Warm preview finding

A direct asset inspection confirms `retail-assistant.jpg` is a valid 300x200 JPEG. However, the warmed `/discover/part-time` web preview still shows the card background placeholders instead of photos, while Inter text and mapped icons are also absent. This points to the web asset/font startup pipeline rather than missing files in the discovery card implementation. The next fix should preserve native `require` sources but add a web-safe static asset path and verify font/icon loading after a clean restart.

## Latest visual validation

The dedicated category-results layout now matches the supplied reference structure: top back/title/count row, filter icon, compact listing rows, green pay emphasis, bookmark affordances, and five-item bottom navigation. Apply Detail shows the optional CV / Resume card and Search shows the stronger header typography. The bundled photo files are valid but the web preview still renders their pale placeholder backgrounds, so image delivery remains the final visual issue to resolve before checkpointing.

## Asset URL diagnosis

The preview route exposes no `img` nodes because the compact card uses a React Native View with a CSS background on web. Direct navigation to `/images/retail-assistant.jpg` returns the preview’s unavailable page, so the root folder is not a static server mount. The stable solution is to use Metro’s resolved asset URI from the `require` module for the web background, while retaining local `require` sources for native.

## Final category validation

After regenerating the URI map and rebuilding the web bundle, Part-time, Internship, Weekend, and Remote result routes render the intended compact layout with working photos wherever bundled. Search retains its reference-led hero and quick-search destinations; Apply retains the full-width hero and optional CV card. The remaining pale placeholder rows correspond to listings without bundled local art (for example Weekend Cashier and several remote roles), while all route bundles compile and export successfully.

- 2026-08-27: Direct browser inspection of /onboarding showed the root LaunchGate mounted but still rendering its temporary background after the timeout interval; the root document contained only the LaunchGate loading view and emitted no browser console error. The web preview’s AsyncStorage adapter is not resolving reliably, so onboarding persistence should use a web-safe synchronous localStorage read/write path with a bounded fallback, while native continues using AsyncStorage.

- 2026-08-27: Browser DOM inspection confirmed the blank onboarding and Boost previews were caused by RootLayout stopping before the navigation tree at the unresolved `useFonts` gate; LaunchGate was not yet mounted. RootLayout now allows web rendering while fonts settle, preserving the native splash gate.

- 2026-08-27: After the web font gate was bypassed, the DOM still showed only the LaunchGate loading background. The final root fix removes the temporary blank return entirely, allowing the current route tree to render immediately while onboarding completion is read and redirects occur asynchronously.

- 2026-08-27: The onboarding welcome route renders correctly in browser preview. The synthetic click helper did not advance the React Native button, but the visible `Get Started` button was present and advanced successfully when activated through the browser DOM. Continue validating the map step using the rendered route state rather than treating the first click limitation as an app defect.
