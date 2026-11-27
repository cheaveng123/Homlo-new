import { useIsFocused } from "@/lib/router";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { spacing } from "@/components/home/theme";
import {
  CAROUSEL_GLIDE_MS,
  CAROUSEL_IDLE_RESUME_MS,
  CAROUSEL_INTERVAL_MS,
  CAROUSEL_REWIND_MS,
  cardOffset,
  clampScrollTarget,
  isCarouselLoopPoint,
  maxScrollOffset,
  nextCarouselIndex,
} from "@/lib/carousel-math";

type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * Card width used by the shared two-column card design. Exported so the home
 * rows and the carousel agree on the exact same fixed width.
 */
export const CAROUSEL_CARD_WIDTH = 200;

const EXTERNAL_SCROLL_THRESHOLD = 24;

export type AutoScrollRowProps<T> = {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  /** Fixed card width — must match the caller's rendered card width. */
  cardWidth?: number;
  cardGap?: number;
  /** Content container's leading/trailing padding. */
  gutter?: number;
  /** Dwell time between advances. */
  intervalMs?: number;
  /** Eased glide duration for advancing one card. */
  glideMs?: number;
  /** Eased glide duration for the loop back to the first card. */
  rewindMs?: number;
};

/**
 * Auto-advancing horizontal carousel used solely for the Recommended jobs row.
 *
 * Advances one card every `intervalMs` (5s) with an eased glide
 * (`Easing.out(Easing.cubic)`, ~500ms), landing each card exactly on the
 * start edge, and loops back to the first card with a continuous eased glide —
 * no dead pause, no snap-back.
 *
 * The scroll position is driven on the UI thread: a `withTiming` progress
 * value drives a `useAnimatedReaction` worklet that calls Reanimated's
 * `scrollTo` every frame. Landing offsets come from `lib/carousel-math`, which
 * reads the exact same `cardWidth`/`cardGap`/`gutter` constants that the
 * manual home rows use (`CAROUSEL_CARD_WIDTH`, `spacing.cardGap`,
 * `spacing.screenX`), so the auto path can never drift from the container's
 * real padding or the manual snap grid. The container itself stays a plain
 * horizontal ScrollView (no snapTo* configured) — the carousel simply lands on
 * the same card-start offsets a snap grid would.
 *
 * Interaction rules:
 * - any touch/drag pauses the row instantly and cancels the in-flight glide;
 * - a single ref-guarded idle timer waits ~3.5s after input stops (and after
 *   momentum settles) before auto-scroll resumes;
 * - only one glide can ever run at a time — a stale glide's completion signal
 *   is dropped via a monotonic token, so timers and gestures can't race.
 * All timers are ref-guarded and cleared on blur/unmount.
 */
export default function AutoScrollRow<T>({
  items,
  renderItem,
  cardWidth = CAROUSEL_CARD_WIDTH,
  cardGap = spacing.cardGap,
  gutter = spacing.screenX,
  intervalMs = CAROUSEL_INTERVAL_MS,
  glideMs = CAROUSEL_GLIDE_MS,
  rewindMs = CAROUSEL_REWIND_MS,
}: AutoScrollRowProps<T>) {
  const isFocused = useIsFocused();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const progress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const toX = useSharedValue(0);
  const currentX = useSharedValue(0);

  // Shared values are mutable-by-design, but the React Compiler flags direct
  // writes from JS. All JS-side writes go through this one stable ref; the
  // UI-thread worklets write directly and are not compiler-tracked.
  const sharedRefs = useRef({ progress, fromX, toX, currentX });

  const countRef = useRef(items.length);
  const contentWidthRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const currentIndexRef = useRef(0);
  const pausedRef = useRef(true);
  const focusedRef = useRef(isFocused);
  const reduceMotionRef = useRef(false);
  const timerRef = useRef<TimerHandle | null>(null);
  const idleTimerRef = useRef<TimerHandle | null>(null);
  const glideActiveRef = useRef(false);
  const glideTokenRef = useRef(0);

  // Props mirrored into a ref so timer closures never read stale values.
  const layoutRef = useRef({ cardWidth, cardGap, gutter, intervalMs, glideMs, rewindMs });

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Single-shot scheduler. `fire` is only ever `advance` (see below), which is
  // behaviourally stable (every value it reads lives in refs), so the closure
  // can be captured at schedule time — no "latest callback" ref needed.
  const scheduleTimer = useCallback(
    (delayMs: number, fire: () => void) => {
      clearTimer();
      timerRef.current = setTimeout(fire, Math.max(0, Math.round(delayMs)));
    },
    [clearTimer],
  );

  const stopGlide = useCallback(() => {
    if (!glideActiveRef.current) return;
    glideActiveRef.current = false;
    cancelAnimation(sharedRefs.current.progress);
  }, []);

  // End-of-glide bookkeeping. `token` proves the signal belongs to the glide
  // currently in charge: a cancelled glide that races a newer one is dropped,
  // so two animations can never both be "active" at once. A cancelled glide
  // leaves the loop paused (the cadence chain lives in `advance` itself).
  const finishGlide = useCallback((finished: boolean, token: number) => {
    if (token !== glideTokenRef.current) return;
    glideActiveRef.current = false;
  }, []);

  const startGlide = useCallback(
    (from: number, to: number, durationMs: number) => {
      const { progress: p, fromX: fx, toX: tx, currentX: cx } = sharedRefs.current;
      // Only one scroll animation may be in flight: cancel a running glide
      // before launching the next.
      if (glideActiveRef.current) cancelAnimation(p);
      glideActiveRef.current = true;
      glideTokenRef.current += 1;
      const token = glideTokenRef.current;

      fx.value = from;
      tx.value = to;
      cx.value = from;

      p.value = 0; // sentinel the reaction ignores
      // Completion (natural or cancelled) is reported from here — this
      // callback is a worklet that captures this glide's own `token` by value,
      // so a cancelled glide that races a newer one can never clobber it. The
      // reaction below only applies scroll offsets frame-by-frame.
      p.value = withTiming(
        1,
        { duration: Math.max(60, durationMs), easing: Easing.out(Easing.cubic) },
        (finished) => {
          runOnJS(finishGlide)(finished === true, token);
        },
      );
    },
    [finishGlide],
  );

  // The UI-thread driver: each `withTiming` frame maps the eased progress onto
  // the landing range and applies it to the scroll view. Completion/cancellation
  // is signalled by the `withTiming` callback in `startGlide`, not here.
  useAnimatedReaction(
    () => progress.value,
    (p, prev) => {
      if (prev == null || p === prev || p <= 0) return;
      const eased = Easing.out(Easing.cubic)(p);
      const x = fromX.value + (toX.value - fromX.value) * eased;
      currentX.value = x;
      scrollTo(scrollRef, x, 0, false);
    },
    [scrollRef],
  );

  // One auto-advance step: compute the next card's landing offset from the
  // shared layout constants (card width + gap + gutter), then glide there and
  // chain the next step so the cycle is continuous — one glide at a time,
  // each starting a full dwell after the previous one began. Named-function
  // recursion keeps the self-reference lint-clean. A glide the user interrupts
  // simply stops this line of timers (cleared by `pause`), leaving the row
  // manual until the idle timer hands back control.
  const advance = useCallback(function advanceStep() {
    const { cardWidth: width, cardGap: gap, gutter: pad, intervalMs: hold, glideMs: advanceMs, rewindMs: rewind } =
      layoutRef.current;
    if (!focusedRef.current || pausedRef.current || reduceMotionRef.current) return;
    if (countRef.current <= 1) return;
    if (contentWidthRef.current <= 0 || viewportWidthRef.current <= 0) {
      scheduleTimer(250, advanceStep);
      return;
    }
    if (maxScrollOffset(contentWidthRef.current, viewportWidthRef.current) <= 0) return;

    const loop = isCarouselLoopPoint(currentIndexRef.current, countRef.current);
    const next = nextCarouselIndex(currentIndexRef.current, countRef.current);
    const target = clampScrollTarget(
      cardOffset(next, width, gap, pad),
      contentWidthRef.current,
      viewportWidthRef.current,
    );

    const duration = loop ? rewind : advanceMs;
    currentIndexRef.current = next;
    startGlide(sharedRefs.current.currentX.value, target, duration);
    scheduleTimer(duration + hold, advanceStep);
  }, [scheduleTimer, startGlide]);

  const startLoop = useCallback(() => {
    if (reduceMotionRef.current || pausedRef.current || !focusedRef.current) return;
    scheduleTimer(layoutRef.current.intervalMs, advance);
  }, [scheduleTimer, advance]);

  // Pause everything the moment the row loses focus, resume when it returns.
  useEffect(() => {
    clearTimer();
    clearIdleTimer();
    stopGlide();
    if (isFocused) {
      pausedRef.current = false;
      startLoop();
    } else {
      pausedRef.current = true;
    }
    return () => {
      clearTimer();
      clearIdleTimer();
    };
  }, [isFocused, startLoop, stopGlide, clearTimer, clearIdleTimer]);

  // Restart the loop when the item list grows (a no-op if nothing is scrollable).
  const previousCountRef = useRef(items.length);
  useEffect(() => {
    if (items.length !== previousCountRef.current) {
      previousCountRef.current = items.length;
      if (items.length > 1 && isFocused) startLoop();
    }
  }, [items.length, isFocused, startLoop]);

  useEffect(() => {
    countRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    focusedRef.current = isFocused;
  }, [isFocused]);

  // Respect the OS reduced-motion preference: the row stays fully manual.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) reduceMotionRef.current = value;
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      reduceMotionRef.current = value;
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Unmount / navigate away: drop every timer and cancel any live animation so
  // nothing outlives this screen and no interval ever stacks across renders.
  useEffect(
    () => () => {
      clearTimer();
      clearIdleTimer();
      stopGlide();
      cancelAnimation(sharedRefs.current.progress);
    },
    [clearTimer, clearIdleTimer, stopGlide],
  );

  const pause = useCallback(
    (killGlide: boolean) => {
      pausedRef.current = true;
      clearTimer();
      clearIdleTimer();
      if (killGlide) stopGlide();
    },
    [clearTimer, clearIdleTimer, stopGlide],
  );

  // Resume only from the ref-guarded idle timer: a short quiet stretch with no
  // finger on the glass and no momentum still running, then auto-scroll takes
  // over again at the normal cadence.
  const resumeAfterIdle = useCallback(() => {
    clearIdleTimer();
    pausedRef.current = false;
    if (focusedRef.current && !reduceMotionRef.current) {
      scheduleTimer(layoutRef.current.intervalMs, advance);
    }
  }, [clearIdleTimer, scheduleTimer, advance]);

  const armIdleResume = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(resumeAfterIdle, CAROUSEL_IDLE_RESUME_MS);
  }, [clearIdleTimer, resumeAfterIdle]);

  const syncFromUserScroll = useCallback(
    (x: number) => {
      const { cardWidth, cardGap, gutter: pad } = layoutRef.current;
      const step = cardWidth + cardGap;
      const raw = Math.round((x - pad) / step);
      const clamped = countRef.current > 1 ? Math.max(0, Math.min(raw, countRef.current - 1)) : 0;
      currentIndexRef.current = clamped;
      sharedRefs.current.currentX.value = x;
    },
    [],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Ignore scroll events emitted by our own glide, then detect movement
      // that didn't come from us (desktop mouse wheel / any non-gesture input)
      // and take over cleanly, with the same idle-before-resume rule.
      if (glideActiveRef.current) return;
      const x = e.nativeEvent.contentOffset.x;
      if (Math.abs(sharedRefs.current.currentX.value - x) > EXTERNAL_SCROLL_THRESHOLD) {
        pause(true);
        syncFromUserScroll(x);
        armIdleResume();
      }
    },
    [pause, syncFromUserScroll, armIdleResume],
  );

  const handleDragEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncFromUserScroll(e.nativeEvent.contentOffset.x);
      armIdleResume();
    },
    [syncFromUserScroll, armIdleResume],
  );

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        onLayout={(e) => {
          viewportWidthRef.current = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(width) => {
          contentWidthRef.current = width;
        }}
        onTouchStart={() => pause(true)}
        onTouchEnd={armIdleResume}
        onScrollBeginDrag={() => pause(true)}
        onScrollEndDrag={handleDragEnd}
        // Momentum must finish settling before the idle countdown starts —
        // re-arming here keeps the resume from ever landing mid-gesture.
        onMomentumScrollEnd={handleDragEnd}
        onScroll={handleScroll}
        contentContainerStyle={{ gap: cardGap, paddingHorizontal: gutter }}
      >
        {items.map((item) => renderItem(item))}
      </Animated.ScrollView>
    </View>
  );
}