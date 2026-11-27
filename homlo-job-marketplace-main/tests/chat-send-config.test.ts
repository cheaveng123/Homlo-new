import { describe, expect, it } from 'vitest';

import {
  READINESS_TRANSITION_MS,
  SEND_ECHO_TRAVEL_PX,
  SEND_EXIT_MS,
  SEND_TAP_SCALE_DOWN_MS,
  SEND_TAP_SCALE_UP_MS,
  hasText,
} from '../components/chat/send-config';

describe('chat send choreography config', () => {
  it('cross-fades the enabled/disabled send-button states within 150–200ms', () => {
    expect(READINESS_TRANSITION_MS).toBeGreaterThanOrEqual(150);
    expect(READINESS_TRANSITION_MS).toBeLessThanOrEqual(200);
  });

  it('squeezes the send button down and back up in ~100–120ms on tap', () => {
    const total = SEND_TAP_SCALE_DOWN_MS + SEND_TAP_SCALE_UP_MS;
    expect(total).toBeGreaterThanOrEqual(100);
    expect(total).toBeLessThanOrEqual(120);
  });

  it('flies the outgoing text from the input to the thread over 200–250ms', () => {
    expect(SEND_EXIT_MS).toBeGreaterThanOrEqual(200);
    expect(SEND_EXIT_MS).toBeLessThanOrEqual(250);
  });

  it('travels a small fixed distance upward toward the message list', () => {
    expect(SEND_ECHO_TRAVEL_PX).toBeGreaterThan(0);
    expect(SEND_ECHO_TRAVEL_PX).toBeLessThanOrEqual(60);
  });

  it('only allows non-whitespace text to send', () => {
    expect(hasText('')).toBe(false);
    expect(hasText('   ')).toBe(false);
    expect(hasText('\n\t ')).toBe(false);
    expect(hasText('  hi  ')).toBe(true);
  });
});