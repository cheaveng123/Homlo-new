// Color tokens for the job details / apply flow redesign.
// Keep new UI in this flow pulling from here instead of hardcoding hex values.

export const colors = {
  // Base
  background: "#FFFFFF",
  surface: "#FFFFFF",
  ink: "#14181A", // primary text — near-black, not pure black
  muted: "#6B7280", // secondary text
  border: "#E5E7EB",

  // Mint — the single accent color. Used for the primary CTA, checkmarks,
  // verified badge, and small tinted fills. Do not use mint for large
  // background areas — it stays an accent, not a base color.
  mint: "#0891B2",
  mintDark: "#0891B2", // pressed / active state for mint buttons
  mintTint: "#EEF7FA", // light fill behind mint icons/badges
  mintDeep: "#14324A", // text placed on top of mintTint

  // Status
  warning: "#B45309", // "Only 2 spots left" style urgency text
  danger: "#B42318", // form validation errors

  // Image placeholder frame
  placeholderBg: "#F3F4F6",
  placeholderBorder: "#DCE6EA",
  placeholderIcon: "#8A9290",
};