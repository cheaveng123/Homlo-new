import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useColorScheme,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { jobSeekerWords } from './searchPlaceholderWords';

export type AnimatedPlaceholderProps = {
  /** Fixed text before the rotating word. */
  prefix?: string;
  /** Words that scroll up. First item is always shown first. */
  words?: string[];
  /** Color of the rotating word. Pass your theme's soft blue token here. */
  color?: string;
  /** Color of the fixed prefix. Pass your theme's placeholder color here. */
  prefixColor?: string;
  /** Pass the same font family your search input uses. */
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  /** Time between words in ms. */
  intervalMs?: number;
  /**
   * Scroll animation length in ms. Also drives the scale pop (both run off the
   * same `u`), so it has to be long enough for the enlarge to actually register
   * — 550ms made the pop unreadable against the swap.
   */
  duration?: number;
  /** How many words to show before reshuffling. */
  cycleSize?: number;
  /** false when the input is focused or has text. Fades out and stops the timer. */
  visible?: boolean;
  /** Extra pause switch, for example when the screen is not focused. */
  paused?: boolean;
  /**
   * Lay the placeholder out in normal flow rather than over the whole parent.
   * Use this whenever a sibling icon sits before it: the default variant fills
   * the parent absolutely, and an absolute child is positioned against the
   * parent's padding box, so it starts at the parent's edge and paints straight
   * under that icon. Going inline hands the spacing back to the parent's own
   * padding and gap, which can't drift out of sync with the icon the way a
   * hand-measured inset does.
   */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
};

const MAX_FONT_SCALE = 1.3;

function shuffle<T>(input: T[]): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AnimatedPlaceholder({
  prefix = 'Search for',
  words = jobSeekerWords,
  color,
  prefixColor,
  fontFamily,
  fontSize = 16,
  lineHeight = Math.round(fontSize * 1.35),
  intervalMs = 2600,
  duration = 900,
  cycleSize = 7,
  visible = true,
  paused = false,
  inline = false,
  style,
}: AnimatedPlaceholderProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const wordColor = color ?? (dark ? '#8FBBFF' : '#7FAEF0');
  const fixedColor = prefixColor ?? (dark ? '#7A837D' : '#7A837D'); // brighter prefix for better visibility

  // Window height follows system font scaling so text is never clipped.
  const { fontScale } = useWindowDimensions();
  const H = Math.ceil(lineHeight * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE));

  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const mounted = useRef(true);

  // ---- word picking: random, never repeats within a cycle or back to back ----
  const queue = useRef<string[]>([]);
  const last = useRef<string>(words[0] ?? '');
  const nextWord = () => {
    if (queue.current.length === 0) {
      const pool = words.filter((w) => w !== last.current);
      queue.current = shuffle(pool).slice(0, Math.max(1, cycleSize));
    }
    const w = queue.current.shift() as string;
    last.current = w;
    return w;
  };

  // Two slots swap roles every step. Slot 0 shows even steps, slot 1 odd steps.
  // The second slot starts below the window (hidden), so it can begin with the
  // next word in the list without touching refs during render; nextWord() only
  // runs from the animation callback afterwards.
  const [texts, setTexts] = useState<[string, string]>(() => [
    words[0] ?? '',
    words.length > 1 ? words[1] ?? '' : '',
  ]);
  const step = useRef(0);

  // t counts steps and never resets, so there is never a visual jump.
  const t = useMemo(() => new Animated.Value(0), []);
  const u = useMemo(() => Animated.modulo(t, 2), [t]);

  const slot0Y = useMemo(
    () => u.interpolate({ inputRange: [0, 1, 1.001, 2], outputRange: [0, -H, H, 0], extrapolate: 'clamp' }),
    [u, H],
  );
  const slot1Y = useMemo(
    () => u.interpolate({ inputRange: [0, 1, 2], outputRange: [H, 0, -H], extrapolate: 'clamp' }),
    [u, H],
  );
  // The pop runs on its own value, triggered only after the slide has landed
  // (see the loop below). So the word finishes travelling into its final
  // position first, then swells and settles — never enlarging mid-flight.
  const pop = useMemo(() => new Animated.Value(0), []);
  const popScale = useMemo(
    () => pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2], extrapolate: 'clamp' }),
    [pop],
  );

  // ---- fade in / out with the visible prop ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `visible` seeds the value once on mount; listing it would recreate the Animated.Value mid-fade
  const opacity = useMemo(() => new Animated.Value(visible ? 1 : 0), []);
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible, opacity]);

  // ---- system listeners ----
  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted.current && setReduceMotion(v));
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => {
      mounted.current = false;
      t.stopAnimation();
      pop.stopAnimation();
      rm.remove();
      app.remove();
    };
  }, [t, pop]);

  // ---- the loop ----
  const active = visible && !paused && appActive && words.length > 1;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const n = step.current;
      Animated.timing(t, {
        toValue: n + 1,
        duration: reduceMotion ? 0 : duration,
        easing: Easing.bezier(0.22, 0.8, 0.3, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !mounted.current) return;
        step.current = n + 1;
        // The slot that just scrolled out is now hidden: give it the next word.
        const w = nextWord();
        setTexts((prev) => (n % 2 === 0 ? [w, prev[1]] : [prev[0], w]));
        // The word has landed. Only now run the enlarge pop, so it reads as the
        // resting word swelling rather than being stretched through the slide.
        if (!reduceMotion) {
          pop.setValue(0);
          Animated.sequence([
            Animated.timing(pop, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(pop, { toValue: 0, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]).start();
        }
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      });
    };

    timer = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs, duration, reduceMotion, t, pop]);

  const textStyle: TextStyle = { fontSize, lineHeight, fontFamily, height: H };

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[inline ? styles.inlineRow : styles.row, { opacity }, style]}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyle, { color: fixedColor }]}
      >
        {prefix}
      </Text>
      <View style={[styles.window, { height: H }]}>
        <Animated.Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.word, textStyle, { color: wordColor, transform: [{ translateY: slot0Y }, { scale: popScale }] }]}
        >
          {texts[0]}
        </Animated.Text>
        <Animated.Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.word, textStyle, { color: wordColor, transform: [{ translateY: slot1Y }, { scale: popScale }] }]}
        >
          {texts[1]}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Shares the row's inner layout but sits in normal flow, taking the space the
  // parent has left after its other children instead of covering all of it.
  inlineRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  window: {
    flex: 1,
    marginStart: 4,
    overflow: 'hidden',
  },
  word: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    fontWeight: '600',
    textShadowColor: 'rgba(143,179,255,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
