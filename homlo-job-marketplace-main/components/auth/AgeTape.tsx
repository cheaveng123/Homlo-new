// components/auth/AgeTape.tsx
// A straight "compass heading tape" picker for age: a horizontal scale of ticks
// slides under a fixed needle, snapping one year per tick. Major ticks every
// 5 years carry a label. A light haptic fires as each year passes the needle.
// Screen readers get an adjustable control with increment/decrement actions.
import { useEffect, useMemo, useRef } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import * as Haptics from "@/lib/native/haptics";
import Svg, { Path } from "react-native-svg";

import { familyForWeight } from "@/lib/typography";

const TICK_W = 14;
const TAPE_H = 92;

const C = {
  ink: "#14324A",
  muted: "#6A7C84",
  minor: "#C3D1D6",
  major: "#14324A",
  needle: "#F5A524",
  track: "#FFFFFF",
  line: "#E6EDEF",
  band: "#DCF1F6",
};

type Props = {
  min: number;
  max: number;
  value: number;
  width: number;
  onChange: (value: number) => void;
};

export default function AgeTape({ min, max, value, width, onChange }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const lastValue = useRef(value);
  const side = Math.max(0, width / 2 - TICK_W / 2);
  const ticks = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [min, max]);

  // Keep the tape in sync when the value changes from outside (e.g. accessibility actions).
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      scrollRef.current?.scrollTo({ x: (value - min) * TICK_W, animated: true });
    }
  }, [value, min]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(max, Math.max(min, min + Math.round(e.nativeEvent.contentOffset.x / TICK_W)));
    if (next !== lastValue.current) {
      lastValue.current = next;
      if (Platform.OS !== "web") void Haptics.selectionAsync();
      onChange(next);
    }
  };

  return (
    <View
      style={[styles.wrap, { width }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Age"
      accessibilityValue={{ min, max, now: value, text: `${value} years old` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment" && value < max) onChange(value + 1);
        if (e.nativeEvent.actionName === "decrement" && value > min) onChange(value - 1);
      }}
    >
      {/* soft band behind the needle */}
      <View pointerEvents="none" style={[styles.band, { left: width / 2 - 26 }]} />

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TICK_W}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentOffset={{ x: (value - min) * TICK_W, y: 0 }}
        onLayout={() => scrollRef.current?.scrollTo({ x: (value - min) * TICK_W, animated: false })}
        contentContainerStyle={{ paddingHorizontal: side }}
      >
        {ticks.map((n) => {
          const major = n % 5 === 0;
          return (
            <View key={n} style={styles.tickSlot}>
              <View style={[styles.tick, major ? styles.tickMajor : styles.tickMinor]} />
              {major && <Text style={[styles.tickLabel, n === value && styles.tickLabelActive]}>{n}</Text>}
            </View>
          );
        })}
      </ScrollView>

      {/* baseline of the tape */}
      <View pointerEvents="none" style={styles.baseline} />

      {/* fixed needle */}
      <View pointerEvents="none" style={[styles.needleWrap, { left: width / 2 - 9 }]}>
        <Svg width={18} height={12} viewBox="0 0 18 12">
          <Path d="M1 1 H17 L9 11 Z" fill={C.needle} stroke={C.needle} strokeWidth="1.5" strokeLinejoin="round" />
        </Svg>
        <View style={styles.needleLine} />
      </View>

      {/* edge fades */}
      <View pointerEvents="none" style={[styles.fade, { left: 0 }]}>
        {[0.95, 0.75, 0.5, 0.25].map((o, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${o})` }} />
        ))}
      </View>
      <View pointerEvents="none" style={[styles.fade, { right: 0, flexDirection: "row-reverse" }]}>
        {[0.95, 0.75, 0.5, 0.25].map((o, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${o})` }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: TAPE_H,
    alignSelf: "center",
    backgroundColor: C.track,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  band: { position: "absolute", top: 0, bottom: 0, width: 52, backgroundColor: C.band, opacity: 0.55 },
  tickSlot: { width: TICK_W, height: TAPE_H, alignItems: "center", paddingTop: 16 },
  tick: { width: 2, borderRadius: 1 },
  tickMinor: { height: 18, backgroundColor: C.minor },
  tickMajor: { height: 32, backgroundColor: C.major },
  tickLabel: {
    position: "absolute",
    top: 54,
    left: (TICK_W - 40) / 2,
    width: 40,
    textAlign: "center",
    fontFamily: familyForWeight("600"),
    fontSize: 13,
    color: C.muted,
  },
  tickLabelActive: { color: C.ink },
  baseline: { position: "absolute", left: 0, right: 0, top: 15, height: 1, backgroundColor: C.line },
  needleWrap: { position: "absolute", top: 0, width: 18, alignItems: "center" },
  needleLine: { width: 3, height: 44, borderRadius: 1.5, backgroundColor: C.needle, marginTop: -2 },
  fade: { position: "absolute", top: 0, bottom: 0, width: 56, flexDirection: "row" },
});
