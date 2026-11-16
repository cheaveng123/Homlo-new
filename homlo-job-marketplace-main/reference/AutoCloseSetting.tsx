/**
 * AutoCloseSetting.tsx
 *
 * Drop-in section for the EXISTING "Post a Job" screen — renders directly
 * below the positions-available field. Not a page, not a modal, not a
 * new route. Import it and place it where the spec calls for it.
 *
 * Usage inside the existing Post a Job screen:
 *
 *   <PositionsField ... />
 *   <AutoCloseSetting
 *     positionsAvailable={form.positionsAvailable}
 *     enabled={form.autoCloseEnabled}
 *     onChange={(val) => setForm(f => ({ ...f, autoCloseEnabled: val }))}
 *   />
 *
 * `enabled` / `onChange` should be wired to whatever the existing Post a
 * Job form state/hook already uses (React Hook Form, useState, Zustand
 * slice — match what's already there, don't introduce a second pattern).
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

const COLORS = {
  accent: '#0F6E56',
  ink: '#1C1F1E',
  inkSecondary: '#4B534F',
  line: '#E4E7E5',
  surface: '#FFFFFF',
  trackOff: '#C9CDCB',
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
    positionsAvailable === 1 ? '1 position has' : `all ${positionsAvailable} positions have`;

  const description = enabled
    ? `Close this job automatically once ${positionsLabel} been filled.`
    : 'You will need to close this job manually once positions are filled.';

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
    fontWeight: '600',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    fontWeight: '500',
    color: COLORS.ink,
    marginBottom: 4,
  },
  description: {
    fontSize: 12.5,
    color: COLORS.inkSecondary,
    lineHeight: 18,
  },
});
