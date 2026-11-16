/**
 * 01_AnimatedSearchPlaceholder.tsx  →  rename to components/search/AnimatedSearchPlaceholder.tsx
 *
 * WHY THIS EXISTS
 * A native <TextInput placeholder="..."> is drawn by iOS/Android, not by React, so it can't be typed out,
 * faded, or scaled. The fix is to render our own animated <Text> on top of the field and hide it when the
 * user focuses / types. The overlay never intercepts touches.
 *
 * Needs: react-native-reanimated (v4 in the app — only basic shared values / withTiming / withSequence used),
 *        @react-navigation/native (comes with expo-router). No extra installs.
 *
 * USAGE (inside the EXISTING search field container — same parent as the TextInput / Pressable):
 *
 *   <View style={styles.field}>                       // existing field, must be position: 'relative' (default)
 *     <Search size={20} strokeWidth={2} color={...} /> // existing icon
 *     <View style={{ flex: 1 }}>                       // wrapper around the text area
 *       <TextInput
 *         value={query}
 *         onChangeText={setQuery}
 *         onFocus={() => setFocused(true)}
 *         onBlur={() => setFocused(false)}
 *         placeholder=""                               // IMPORTANT: no native placeholder, or you'll see two
 *         accessibilityLabel="Search jobs, skills or companies"
 *         style={...existing input style...}
 *       />
 *       <AnimatedSearchPlaceholder
 *         visible={!focused && query.length === 0}
 *         fontFamily={familyForWeight(500)}            // Inter 500, same as the old placeholder
 *       />
 *     </View>
 *   </View>
 *
 * If the home bar is a tap-to-open <Pressable> (not an editable input), just pass visible={true}.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';

/* ───────────── typewriter hook ───────────── */
type TypewriterOpts = {
  typeMs: number;
  deleteMs: number;
  holdMs: number;
  startDelayMs: number;
  onComplete?: () => void; // fires each time a word finishes typing
};

function useTypewriter(words: string[], running: boolean, o: TypewriterOpts) {
  const [text, setText] = useState('');
  const onCompleteRef = useRef(o.onComplete);
  onCompleteRef.current = o.onComplete;
  const key = words.join('|');

  useEffect(() => {
    if (!running || words.length === 0) return;

    let idx = 0;
    let n = 0;
    let phase: 'type' | 'hold' | 'delete' = 'type';
    let timer: ReturnType<typeof setTimeout>;
    setText('');

    const tick = () => {
      const w = words[idx];
      if (phase === 'type') {
        n += 1;
        setText(w.slice(0, n));
        if (n >= w.length) {
          phase = 'hold';
          onCompleteRef.current?.(); // → scale pop
          timer = setTimeout(tick, o.holdMs);
        } else {
          timer = setTimeout(tick, o.typeMs);
        }
      } else if (phase === 'hold') {
        phase = 'delete';
        timer = setTimeout(tick, o.deleteMs);
      } else {
        n -= 1;
        setText(w.slice(0, Math.max(n, 0)));
        if (n <= 0) {
          idx = (idx + 1) % words.length;
          phase = 'type';
          timer = setTimeout(tick, 280); // small beat between words
        } else {
          timer = setTimeout(tick, o.deleteMs);
        }
      }
    };

    timer = setTimeout(tick, o.startDelayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, o.typeMs, o.deleteMs, o.holdMs, o.startDelayMs]);

  return text;
}

/* ───────────── component ───────────── */
type Props = {
  /** Show the overlay. Pass `!focused && query.length === 0` for an editable input. */
  visible?: boolean;
  /** Static text before the typed word. Set to '' and pass full phrases in `words` to type whole phrases. */
  prefix?: string;
  words?: string[];
  fontFamily?: string; // pass familyForWeight(500)
  fontSize?: number;
  color?: string;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  startDelayMs?: number;
  popScale?: number; // peak of the completion pop (1.00 → popScale → 1.00)
  style?: ViewStyle; // e.g. { left: 2 } to nudge against the input's text inset
};

export function AnimatedSearchPlaceholder({
  visible = true,
  prefix = 'Search ',
  words = ['jobs', 'skills', 'companies'],
  fontFamily,
  fontSize = 16,
  color = '#66736A',
  typeMs = 70,
  deleteMs = 35,
  holdMs = 1600,
  startDelayMs = 400,
  popScale = 1.05,
  style,
}: Props) {
  const isFocused = useIsFocused(); // pause when the screen is not on top
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const running = visible && isFocused && appActive && !reduceMotion;

  const scale = useSharedValue(1);
  const fade = useSharedValue(visible ? 1 : 0);

  const typed = useTypewriter(words, running, {
    typeMs,
    deleteMs,
    holdMs,
    startDelayMs,
    onComplete: () => {
      scale.value = withSequence(
        withTiming(popScale, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 170, easing: Easing.inOut(Easing.quad) }),
      );
    },
  });

  useEffect(() => {
    fade.value = withTiming(visible ? 1 : 0, { duration: 140 });
  }, [visible, fade]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }],
  }));

  // Reduce Motion → static, readable placeholder (no typing, no pop)
  const label = reduceMotion ? `${prefix}${words[0] ?? ''}` : `${prefix}${typed}`;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]} importantForAccessibility="no-hide-descendants" accessible={false}>
      <Animated.Text
        numberOfLines={1}
        style={[
          { fontFamily, fontSize, color, lineHeight: Math.round(fontSize * 1.25), transformOrigin: 'left center' },
          animStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
});

export default AnimatedSearchPlaceholder;
