# Homlo Jobs — Mobile Interface Design

## Product Direction

Homlo Jobs is a friendly, local-first marketplace for flexible work. The interface uses warm white surfaces, deep teal actions, gentle mint accents, and compact information hierarchy to make browsing jobs feel calm and fast. Every screen is designed for a 9:16 portrait viewport, with primary actions reachable in the lower half of the display and no reliance on hover-only behavior.

## Visual System

| Element | Choice | Purpose |
|---|---|---|
| Brand color | `#08675F` deep teal | Primary actions, active navigation, and key status text. |
| Soft accent | `#EAF6F3` pale mint | Icon wells, tags, and promotional panels. |
| Canvas | `#FFFEFC` warm white | Clean, lightweight screen background. |
| Primary text | `#16211F` charcoal green | Clear readable hierarchy. |
| Secondary text | `#64716E` muted slate | Supporting metadata and labels. |
| Border | `#E7ECEA` mist gray | Card outlines and dividers. |
| Radius | 16–22 px | Approachable iOS-style cards and controls. |

## Screen List

| Screen | Primary content and functionality |
|---|---|
| Home | Brand header, favorites shortcut, profile shortcut, search card, category rail, nearby job list, and employer call-to-action. Users can choose a category, open job search, and save a job. |
| Jobs | Search field, category filters, job results, and a result count. Users can search by role, company, or skill and tap categories to filter results. |
| Saved | Saved-job state with a clear empty state. Users can remove saved jobs or open a saved listing. |
| Profile | Local worker profile summary and menu rows for preferences, notifications, and support. |
| Job Detail | A focused listing view with job title, company, shift or pay information, description highlights, and a prominent Apply action. |

## Key User Flows

| Flow | Steps |
|---|---|
| Discover nearby work | Home → tap an explore category or Search jobs → Jobs list filtered to a relevant role type. |
| Search for an opportunity | Jobs → enter a role, skill, or company → matching results update → tap card → Job Detail. |
| Save a role for later | Home or Jobs → tap the heart icon → tactile feedback and saved state → Saved tab displays the listing. |
| Review a job | Tap a job card → Job Detail → inspect key information → Apply action shows a confirmation notice. |
| Access profile settings | Tab bar → Profile → choose an account/support menu item → show brief acknowledgement. |

## Interaction Principles

Cards use opacity feedback on press, while the primary search and apply actions use a restrained scale response. Selection changes are accompanied by light haptic feedback when supported. The tab bar remains visible at the bottom so that users can change context from any main screen without reaching for a hidden menu.

