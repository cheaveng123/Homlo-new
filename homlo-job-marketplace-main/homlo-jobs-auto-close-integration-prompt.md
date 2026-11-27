You are working on the existing **Homlo Jobs React Native (Expo) mobile app**.

The auto-close application setting and the three application notifications
(accepted / declined / job filled) have already been designed and coded.
Your job is to **integrate the attached files into the existing app** —
not build the feature from scratch, and not create any new pages.

Attached files:
- `AutoCloseSetting.tsx` — setting row component for the existing Post a Job screen
- `JobStatusPill.tsx` — status pill/line component for the existing Job Detail screen
- `applicationNotifications.ts` — formatting helpers for the existing Alerts screen's Applications tab
- `jobsRepository.additions.ts` — two functions to merge into the existing jobs repository
- `001_auto_close_and_notifications.sql` — migration adding the auto-close trigger and notification inserts

## Hard rules

- Do NOT create new pages, new routes, or a new settings screen.
- Do NOT create a new notification-detail screen — notifications open the existing application/job detail screens.
- Do NOT duplicate the applications table, the notifications table, or the job status field if equivalents already exist — extend them.
- Reuse the existing repository layer, hooks, navigation, and Supabase client instead of introducing a second pattern.

## Steps

1. **Inspect first, before changing anything:**
   - The existing Post a Job screen and its form state (React Hook Form / useState / Zustand — whatever it already uses).
   - The existing Job Detail screen's header layout.
   - The existing Alerts screen and its Applications tab — how it fetches and renders notification rows today.
   - The existing `jobs` and `applications` tables — actual column names for status, positions, and any existing auto-close-equivalent or filled/closed status.
   - The existing `notifications` table (or equivalent) and its read/unread handling.

2. **Reconcile the attached files' assumptions with the real schema.**
   The SQL file and `jobsRepository.additions.ts` assume specific column names (`positions_available`, `auto_close_enabled`, `status` values including `open`/`filled`, a `notifications` table with `user_id`/`type`/`job_id`/`application_id`/`read_at`). Adjust names in the migration and repository functions to match what actually exists rather than adding duplicate columns or tables. If a `filled`/`closed` status equivalent already exists, reuse it instead of adding `filled`.

3. **Apply the migration** (`001_auto_close_and_notifications.sql`) as a new version-controlled migration file, adjusted per step 2. Do not apply it by hand in a dashboard.

4. **Wire `AutoCloseSetting`** into the existing Post a Job screen, directly below the existing positions-available field, bound to the existing form state and to `updateAutoCloseSetting` from `jobsRepository.additions.ts`.

5. **Wire `JobStatusPill` (or `JobStatusLine`)** into the existing Job Detail screen's header, sourcing `status` and `positionsAvailable` from the existing job-detail data fetch — don't add a second fetch. Disable/relabel the existing Apply button when the job is filled, matching however the screen currently handles a closed/unavailable job (if it already has that handling, reuse it).

6. **Wire the Applications tab** in the existing Alerts screen to run each notification row through `formatApplicationNotification` from `applicationNotifications.ts` before rendering with the existing list-row component, and use `getNotificationTarget` for the existing tap-to-navigate handler. Preserve the existing unread-indicator and mark-as-read logic — don't build a new one.

7. **Confirm the trigger path end-to-end**: accepting an application marks it `hired`, which should notify the applicant and, once every position is hired, flip the job to filled and notify remaining pending applicants. Rejecting an application should only send the "Application update" notification.

## Verification checklist

- Toggling auto-close on the Post a Job screen persists and reloads correctly.
- Accepting applications one at a time correctly leaves the job open until the last position is filled.
- The job auto-closes only when auto-close is enabled; with it disabled, the job stays open regardless of hired count and the employer must close it manually.
- The Job Detail pill and Apply button reflect Open vs Filled correctly on both the applicant and employer views.
- Accepting an application creates exactly one "Application accepted" notification for that applicant.
- Declining an application creates exactly one "Application update" notification for that applicant.
- When a job fills, every applicant still `applied`/`reviewed`/`interview` gets exactly one "Job filled" notification, and no duplicate notifications are created on repeated status changes.
- Tapping each notification type opens the correct existing screen (application detail for accepted/declined, job detail for job filled).
- Unread indicators clear using the existing read-status logic once a notification is viewed.
- No existing Post a Job, Job Detail, or Alerts functionality regresses.
