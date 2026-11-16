import { useEffect, useRef, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SearchIcon } from "./icons";

import { colors, radii, type } from "./theme";

const PHRASES = ["Search jobs", "Search skills", "Search companies"];

// Only the placeholder text animates — the bar itself never moves or resizes.
// Tapping the bar opens the search flow (the real query input lives there).
export function AnimatedSearchBar({ onPress }: { onPress?: () => void }) {
  const [text, setText] = useState("");
  const scale = useSharedValue(1);
  const phraseIndex = useRef(0);
  const charIndex = useRef(0);
  const deleting = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = PHRASES[phraseIndex.current];
      if (!deleting.current) {
        charIndex.current += 1;
        setText(word.slice(0, charIndex.current));
        if (charIndex.current === word.length) {
          scale.value = withSequence(
            withTiming(1.05, { duration: 120 }),
            withTiming(1, { duration: 140 }),
          );
          deleting.current = true;
          timer = setTimeout(tick, 1400);
          return;
        }
      } else {
        charIndex.current -= 1;
        setText(word.slice(0, charIndex.current));
        if (charIndex.current === 0) {
          deleting.current = false;
          phraseIndex.current = (phraseIndex.current + 1) % PHRASES.length;
        }
      }
      timer = setTimeout(tick, deleting.current ? 35 : 65);
    };
    timer = setTimeout(tick, 65);
    return () => clearTimeout(timer);
  }, [scale]);

  const placeholderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Search jobs"
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <SearchIcon size={17} color={colors.sub} />
      <Animated.Text style={[type.searchPlaceholder, styles.grow, placeholderStyle]}>
        {text}
        <Text style={styles.cursor}>|</Text>
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    borderRadius: radii.searchBar,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: "#0A2820",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: { opacity: 0.9 },
  grow: { flexShrink: 1 },
  cursor: { color: colors.sub },
});