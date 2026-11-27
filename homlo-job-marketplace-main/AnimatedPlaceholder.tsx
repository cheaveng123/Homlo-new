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
  /** Scroll animation length in ms. */
  duration?: number;
  /** How many words to show before reshuffling. */
  cycleSize?: number;
  /** false when the input is focused or has text. Fades out and stops the timer. */
  visible?: boolean;
  /** Extra pause switch, for example when the screen is not focused. */
  paused?: boolean;
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
  intervalMs = 2200,
  duration = 550,
  cycleSize = 7,
  visible = true,
  paused = false,
  style,
}: AnimatedPlaceholderProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const wordColor = color ?? (dark ? '#8FBBFF' : '#7FAEF0');
  const fixedColor = prefixColor ?? (dark ? '#7F8DA0' : '#8A97A6');

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
  const [texts, setTexts] = useState<[string, string]>(() => [
    words[0] ?? '',
    words.length > 1 ? nextWord() : '',
  ]);
  const step = useRef(0);

  // t counts steps and never resets, so there is never a visual jump.
  const t = useRef(new Animated.Value(0)).current;
  const u = useMemo(() => Animated.modulo(t, 2), [t]);

  const slot0Y = useMemo(
    () => u.interpolate({ inputRange: [0, 1, 1.001, 2], outputRange: [0, -H, H, 0], extrapolate: 'clamp' }),
    [u, H],
  );
  const slot1Y = useMemo(
    () => u.interpolate({ inputRange: [0, 1, 2], outputRange: [H, 0, -H], extrapolate: 'clamp' }),
    [u, H],
  );

  // ---- fade in / out with the visible prop ----
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
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
      rm.remove();
      app.remove();
    };
  }, [t]);

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
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      });
    };

    timer = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs, duration, reduceMotion, t]);

  const textStyle: TextStyle = { fontSize, lineHeight, fontFamily, height: H };

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { opacity }, style]}
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
          style={[styles.word, textStyle, { color: wordColor, transform: [{ translateY: slot0Y }] }]}
        >
          {texts[0]}
        </Animated.Text>
        <Animated.Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.word, textStyle, { color: wordColor, transform: [{ translateY: slot1Y }] }]}
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
  window: {
    flex: 1,
    marginStart: 5,
    overflow: 'hidden',
  },
  word: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    fontWeight: '600',
  },
});
