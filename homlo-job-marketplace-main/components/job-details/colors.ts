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
  mint: "#16C79A",
  mintDark: "#109C79", // pressed / active state for mint buttons
  mintTint: "#E5FBF4", // light fill behind mint icons/badges
  mintDeep: "#0B3D30", // text placed on top of mintTint

  // Status
  warning: "#B45309", // "Only 2 spots left" style urgency text
  danger: "#B42318", // form validation errors

  // Image placeholder frame
  placeholderBg: "#F3F4F6",
  placeholderBorder: "#C7CCCA",
  placeholderIcon: "#8A9290",
};