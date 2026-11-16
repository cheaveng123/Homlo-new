import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import AnimatedPlaceholder from './AnimatedPlaceholder';
import { employerWords, jobSeekerWords } from './searchPlaceholderWords';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  /** 'seeker' shows job titles, 'employer' shows applicant types. */
  role?: 'seeker' | 'employer';
  /** Your existing search icon element. */
  leftIcon?: React.ReactNode;
  /** Pass true when the screen is not focused (see usage below). */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Demo wrapper. If you already have a search bar, DO NOT replace it with this.
 * Copy only the three marked lines into your existing component.
 */
export default function AnimatedSearchBar({
  value,
  onChangeText,
  onSubmitEditing,
  role = 'seeker',
  leftIcon,
  paused,
  style,
}: Props) {
  const [focused, setFocused] = useState(false); // (1) track focus

  return (
    <View style={[styles.bar, style]}>
      {leftIcon}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // (2) no `placeholder` prop here, the overlay replaces it
          accessibilityLabel={role === 'seeker' ? 'Search jobs' : 'Search applicants'}
          returnKeyType="search"
          style={styles.input}
        />
        {/* (3) the overlay sits on top of the input and never blocks taps */}
        <AnimatedPlaceholder
          words={role === 'seeker' ? jobSeekerWords : employerWords}
          visible={!focused && value.length === 0}
          paused={paused}
          // Pass your theme tokens so fonts and colors match your app:
          // color={theme.colors.softBlue}
          // prefixColor={theme.colors.placeholder}
          // fontFamily={theme.fonts.regular}
          fontSize={16}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E9F0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  inputWrap: { flex: 1, height: '100%', justifyContent: 'center' },
  input: { flex: 1, padding: 0, fontSize: 16, color: '#1B2A3A' },
});

/* ---------------- Usage ----------------

import { useIsFocused } from '@react-navigation/native';

function HomeScreen() {
  const [q, setQ] = useState('');
  const isFocused = useIsFocused(); // optional: pauses when you navigate away

  return (
    <AnimatedSearchBar
      value={q}
      onChangeText={setQ}
      role="seeker"
      paused={!isFocused}
    />
  );
}
---------------------------------------- */
