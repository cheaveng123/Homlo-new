/**
 * AutoCloseSetting — section for the existing "Post a Job" screen, rendered
 * directly below the positions-available field. Not a page, not a modal, not
 * a new route. `enabled` / `onChange` are wired to the existing wizard form
 * state (useState in post-job.tsx).
 *
 * The auto-close DECISION itself (counting hired vs positions, flipping the
 * job to "filled", firing notifications) lives in the database trigger
 * (migration 036); this component only reads/writes the toggle.
 */

import { View, Text, Switch, StyleSheet } from "react-native";

const COLORS = {
  accent: "#0891B2",
  ink: "#12303C",
  inkSecondary: "#5D7480",
  line: "#DCE6EA",
  surface: "#FFFFFF",
  trackOff: "#C9CDCB",
};

export interface AutoCloseSettingProps {
  /** Number of open positions for this job posting, used in the description copy. */
  positionsAvailable: number;
  /** Current value of the auto-close setting. */
  enabled: boolean;
  /** Called with the new value when the user taps the switch. */
  onChange: (enabled: boolean) => void;
  /** Optional: disable interaction (e.g. while saving). */
  disabled?: boolean;
}

export function AutoCloseSetting({
  positionsAvailable,
  enabled,
  onChange,
  disabled = false,
}: AutoCloseSettingProps) {
  const positionsLabel =
    positionsAvailable === 1 ? "1 position has" : `all ${positionsAvailable} positions have`;

  const description = enabled
    ? `Close this job automatically once ${positionsLabel} been filled.`
    : "You will need to close this job manually once positions are filled.";

  return (
    <View>
      <Text style={styles.sectionLabel}>Application settings</Text>
      <View style={styles.block}>
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={styles.title}>Automatically close when positions are filled</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onChange}
            disabled={disabled}
            trackColor={{ false: COLORS.trackOff, true: COLORS.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={COLORS.trackOff}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.inkSecondary,
    marginTop: 22,
    marginBottom: 10,
  },
  block: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  textCol: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.ink,
    marginBottom: 4,
  },
  description: {
    fontSize: 12.5,
    color: COLORS.inkSecondary,
    lineHeight: 18,
  },
});