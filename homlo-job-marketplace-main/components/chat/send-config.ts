/**
 * components/chat/send-config.ts
 *
 * Timing constants for the chat composer's send choreography. Kept in a pure
 * module so the components and the tests agree on the exact animation windows
 * (mirrors lib/carousel-math for the home carousel).
 */

/** Cross-fade between the disabled and enabled send-button states (150–200ms). */
export const READINESS_TRANSITION_MS = 180;

/** Tap feedback: scale down then back up (~100–120ms total for the squeeze). */
export const SEND_TAP_SCALE_DOWN_MS = 55;
export const SEND_TAP_SCALE_UP_MS = 55;

/**
 * Outgoing-text fly-out: the composed text slides from the input up toward the
 * message list while the input fades back to its empty/placeholder state, and
 * the new bubble lands right as this completes (200–250ms).
 */
export const SEND_EXIT_MS = 230;

/** Upward distance (px) the outgoing-text echo travels toward the thread. */
export const SEND_ECHO_TRAVEL_PX = 28;

/** A send is only possible once there is real text (whitespace doesn't count). */
export function hasText(value: string): boolean {
  return value.trim().length > 0;
}