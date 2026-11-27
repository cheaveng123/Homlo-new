# Inbox / Chat thread — React Native implementation

## What changed from the last mockup
- Removed the green "online" presence dot everywhere (message-row avatar
  and the chat header). The chat header subtitle is back to a plain
  `"Cashier (Weekend)"` — no more "· Active now".
- Converted the approved mockup straight to React Native (Expo), no web.

## File tree (new files)

```
theme/
  tokens.ts                      — colors, radius, spacing, font sizes/weights, fixed sizes

components/
  common/
    IconButton.tsx                — shared circular icon button
    SegmentedTabs.tsx              — Applications / Messages / Updates pill switcher
    SectionLabel.tsx               — "TODAY" / "EARLIER THIS WEEK" label
  inbox/
    InboxHeader.tsx                — title + subtitle + bell
    InboxSearchBar.tsx             — search pill + filter button
    MessageRow.tsx                 — the redesigned message row
  chat/
    ChatHeader.tsx                 — back, avatar, name/role, more menu
    SystemMessageCard.tsx          — "Worker applied to your job." card
    QuickReplyChips.tsx            — scrollable quick-reply chips
    ChatInputBar.tsx               — attach / input / send

screens/
  InboxScreen.tsx                  — composes the inbox screen end to end
  ChatThreadScreen.tsx             — composes the chat thread screen end to end
```

Drop `theme/` and `components/` wherever your app already keeps shared
UI, and wire `InboxScreen` / `ChatThreadScreen` into your existing Expo
Router routes (the bottom tab bar is assumed to already come from your
`<Tabs />` navigator — it isn't re-implemented here).

## Dependencies
- `react-native-svg` — used for every icon (no icon font/library swap
  needed, but if the app already standardized on `lucide-react-native`,
  the icons here can be swapped 1:1 — same stroke widths are noted in
  comments where it matters).

## The fidelity rule — read this before implementing
Every spacing, font-size, font-weight, corner-radius, and color value in
these files was copied **directly** from the approved HTML mockup, not
estimated. `theme/tokens.ts` is the single source of truth:

- If a number isn't in `tokens.ts`, it isn't approved — don't invent one.
- Don't round `14.5` to `15`, don't swap `800` weight for `700`, don't
  change `999` radius to a fixed pixel value "because it looks the
  same" — these are the exact values that were sized against the mockup.
- Do not silently swap `Plus Jakarta Sans` for a different font because
  it isn't loaded yet in the project — either load it via `expo-font`
  under the exact family names in `tokens.ts` (`PlusJakartaSans-Bold`,
  etc.), or flag that it's missing rather than substituting something
  else.
- If a coding agent implementing this needs to adjust a value for a
  real device (e.g. the FAB's `bottom: 24` needs to clear a real tab
  bar height), that specific value should be the *only* thing that
  changes — leave every other token untouched.
