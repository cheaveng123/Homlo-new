/**
 * SearchDetailScreen.tsx
 *
 * "Search detail" screen for Homlo Jobs â€” opened when the user taps the
 * search bar on the home screen (or any search bar in the app). Ported 1:1
 * from the approved HTML mockup: white header (no green background),
 * an auto-focused search field (keyboard opens on mount), recent searches,
 * and an orange "Popular categories" chip row (the old "Trending" section was
 * removed and Popular categories moved up into its place, per the approved
 * revisions).
 *
 * Requires:
 *   Plus Jakarta Sans (700/800) + Inter (400/500/600/700) loaded as fonts â€”
 *   swap the fontFamily strings below if your app already loads different ones.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AnimatedPlaceholder from "@/components/search/AnimatedPlaceholder";
import { jobSeekerWords } from "@/components/search/searchPlaceholderWords";
import { TextInput } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
const COLORS = {
  paper: '#FFFFFF',
  ink: '#12241D',
  inkSoft: '#5A6E66',
  line: '#DCEEE4',
  mint050: '#F2FBF6',
  mint500: '#4FCB94',
  mint600: '#2FAE79',
  forest900: '#0E3B2E',
  forest700: '#155743',
  orange100: '#FFF1DF',
  orange300: '#FBD59F',
  orange600: '#C97A16',
};

type RecentSearch = { id: string; label: string; sub: string };

const DEFAULT_RECENTS: RecentSearch[] = [
  { id: '1', label: 'Hotel front desk', sub: 'Full-time Â· Phnom Penh' },
  { id: '2', label: 'Home cleaning', sub: 'Part-time Â· Near me' },
];

const DEFAULT_CATEGORIES: string[] = [
  'Hospitality',
  'Retail',
  'Construction',
  'Admin & office',
  'Delivery rider',
  'Warehouse packer',
];

type Props = {
  locationLabel?: string;
  recents?: RecentSearch[];
  categories?: string[];
  onBack?: () => void;
  onLocationPress?: () => void;
  onRecentPress?: (item: RecentSearch) => void;
  onRemoveRecent?: (item: RecentSearch) => void;
  onClearRecents?: () => void;
  onCategoryPress?: (category: string) => void;
  onSubmitSearch?: (query: string) => void;
  autoFocus?: boolean;
};

export default function SearchDetailScreen({
  locationLabel = 'Phnom Penh Â· Remote OK',
  recents = DEFAULT_RECENTS,
  categories = DEFAULT_CATEGORIES,
  onBack,
  onLocationPress,
  onRecentPress,
  onRemoveRecent,
  onClearRecents,
  onCategoryPress,
  onSubmitSearch,
  autoFocus = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const submitQuery = () => onSubmitSearch?.(query.trim());
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.top}>
        <View style={styles.row1}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.8}>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loc} onPress={onLocationPress} activeOpacity={0.7}>
            <Text style={styles.locKey}>Searching near</Text>
            <View style={styles.locValRow}>
              <Text style={styles.locVal}>{locationLabel}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.searchInput}>
          <View style={{ flex: 1 }}>
            <TextInput
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel="Search jobs"
              style={[styles.searchField, { flex: 1 }]}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitQuery}
              
              
              returnKeyType="search"
              autoFocus={autoFocus}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.secTitleRow}>
          <Text style={styles.secTitle}>Recent searches</Text>
          <TouchableOpacity onPress={onClearRecents}>
            <Text style={styles.clearLink}>Clear</Text>
          </TouchableOpacity>
        </View>

        {recents.map((item) => (
          <View key={item.id} style={styles.recentRow}>
            <TouchableOpacity
              style={styles.recentLeft}
              onPress={() => onRecentPress?.(item)}
              activeOpacity={0.7}
            >
              <View style={styles.recentIcon}>
              </View>
              <View>
                <Text style={styles.recentLabel}>{item.label}</Text>
                <Text style={styles.recentSub}>{item.sub}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRemoveRecent?.(item)} hitSlop={8}>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.secTitle, styles.secTitleSpaced]}>Popular categories</Text>
        <View style={styles.chipWrap}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={styles.chip}
              onPress={() => onCategoryPress?.(cat)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ICON_BTN_SIZE = 34;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  top: {
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    backgroundColor: COLORS.paper,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E3B2E',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  loc: { flexDirection: 'column', gap: 1 },
  locKey: { fontSize: 11, color: COLORS.inkSoft, fontFamily: 'Inter_500Medium' },
  locValRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: COLORS.forest900,
  },
  searchInput: {
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.mint500,
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    shadowColor: COLORS.mint600,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchField: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: COLORS.ink,
    padding: 0,
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: COLORS.inkSoft,
  },
  secTitleSpaced: { marginTop: 22, marginBottom: 12 },
  clearLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: COLORS.mint600 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  recentIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.mint050,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentLabel: { fontSize: 14, color: COLORS.ink, fontFamily: 'Inter_500Medium' },
  recentSub: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 1, fontFamily: 'Inter_400Regular' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.orange100,
    borderWidth: 1,
    borderColor: COLORS.orange300,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.orange600,
  },
});
