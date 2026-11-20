// components/onboarding/OptionRow.tsx
// The bordered option list used by onboarding and profile setup: a rounded
// group of rows, each with a tinted icon tile, a label (and optional line of
// copy) and a check / radio / chevron on the right. Rows fade up one after
// another and shrink slightly when pressed (house no-bounce motion).
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import { familyForWeight } from "@/lib/typography";
import { PressableScale, Reveal, SMOOTH } from "@/src/design/motion";

const C = {
  primary: "#0891B2",
  primaryDeep: "#0B6F8A",
  ink: "#14324A",
  muted: "#6A7C84",
  faint: "#9AAAB1",
  line: "#E6EDEF",
  bg: "#FFFFFF",
};

export type Tint = "cyan" | "amber" | "navy";
export const TINT: Record<Tint, { bg: string; fg: string }> = {
  cyan: { bg: "#DCF1F6", fg: "#0B6F8A" },
  amber: { bg: "#FDF0D9", fg: "#B8730C" },
  navy: { bg: "#E3E9EE", fg: "#14324A" },
};

export function ListGroup({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return <View style={[styles.list, compact && { marginTop: 10 }]}>{children}</View>;
}

export function IconTile({ icon, tint, size = 44 }: { icon: IconName; tint: Tint; size?: number }) {
  const t = TINT[tint];
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.27, backgroundColor: t.bg }]}>
      <AppIcon name={icon} size={size / 2} strokeWidth={1.8} color={t.fg} />
    </View>
  );
}

export function OptionRow({
  index,
  last,
  label,
  copy,
  icon,
  tint,
  mode,
  selected,
  onPress,
}: {
  index: number;
  last: boolean;
  label: string;
  copy?: string;
  icon: IconName;
  tint: Tint;
  mode: "check" | "radio" | "chevron";
  selected: boolean;
  onPress: () => void;
}) {
  const role = mode === "check" ? "checkbox" : "radio";
  return (
    <Reveal index={index}>
      <PressableScale
        accessibilityRole={role}
        accessibilityState={mode === "check" ? { checked: selected } : { selected }}
        onPress={onPress}
        scale={0.98}
        style={[styles.row, !last && styles.rowDivider, selected && styles.rowSelected]}
      >
        <IconTile icon={icon} tint={tint} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, selected && { color: C.primaryDeep }]}>{label}</Text>
          {copy ? <Text style={styles.rowCopy}>{copy}</Text> : null}
        </View>
        {mode === "chevron" && !selected ? (
          <AppIcon name="chevron" size={20} strokeWidth={1.8} color={C.faint} />
        ) : mode === "chevron" ? (
          <Animated.View entering={ZoomIn.duration(200).easing(SMOOTH)} style={[styles.mark, styles.markOn]}>
            <AppIcon name="check" size={14} strokeWidth={2.6} color="#fff" />
          </Animated.View>
        ) : (
          <View style={[styles.mark, mode === "radio" && styles.markRound, selected && styles.markOn]}>
            {selected && (
              <Animated.View entering={ZoomIn.duration(200).easing(SMOOTH)}>
                <AppIcon name="check" size={14} strokeWidth={2.6} color="#fff" />
              </Animated.View>
            )}
          </View>
        )}
      </PressableScale>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 22, borderWidth: 1.5, borderColor: C.line, borderRadius: 16, backgroundColor: C.bg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, minHeight: 68, paddingVertical: 10, backgroundColor: C.bg },
  rowDivider: { borderBottomWidth: 1.5, borderBottomColor: C.line },
  rowSelected: { backgroundColor: "#F2FAFC" },
  rowLabel: { fontFamily: familyForWeight("700"), fontSize: 15.5, color: C.ink },
  rowCopy: { fontFamily: familyForWeight("400"), fontSize: 12.5, color: C.muted, marginTop: 2 },
  iconTile: { alignItems: "center", justifyContent: "center" },
  mark: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: "#C9D5DA", alignItems: "center", justifyContent: "center" },
  markRound: { borderRadius: 12 },
  markOn: { backgroundColor: C.primary, borderColor: C.primary, borderRadius: 12 },
});
