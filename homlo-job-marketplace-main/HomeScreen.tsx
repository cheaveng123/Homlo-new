import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { HomeHeaderBackground } from './HomeHeaderBackground';
import AnimatedSearchBar from './AnimatedSearchBar';
import { FinderButton } from './FinderButton';
import { QuickSearchRow } from './QuickSearchRow';
import { JobCard, JobCardData, JobCardVariant } from './JobCard';
import { colors, spacing, type } from './theme';
import { PinIcon } from './icons';

// Fallback used only for the very first paint, before onLayout reports the
// panel's real height. The real value always wins once measured — this is
// what fixes the wash cutting off before the finder button / quick search.
const HEADER_HEIGHT_FALLBACK = 300;

interface SectionRow {
  variant: JobCardVariant;
  jobs: JobCardData[];
}
interface Section {
  key: string;
  title: string;
  rows: SectionRow[];
}

// Sample data standing in for the real job feed — same shape the existing
// data layer already returns (title / salary / location), just add
// imageSource once photos are wired up and drop the `tone` field.
const SECTIONS: Section[] = [
  { key: 'recommended', title: 'Recommended for You', rows: [
    { variant: 'featured', jobs: [{ title: 'Senior Product Designer', salary: '$1,800–2,400/mo', location: 'BKK1, Phnom Penh', tone: 1 }] },
    { variant: 'twoCol', jobs: [
      { title: 'Warehouse Associate', salary: '$450/mo', location: 'Chroy Changvar', tone: 2 },
      { title: 'Frontend Engineer', salary: '$1,200/mo', location: 'Toul Kork', tone: 3 },
    ]},
  ]},
  { key: 'featured', title: 'Featured Opportunities', rows: [
    { variant: 'standard', jobs: [
      { title: 'Marketing Lead', salary: '$900/mo', location: 'Daun Penh', tone: 4 },
      { title: 'Line Cook', salary: '$380/mo', location: 'Riverside', tone: 5 },
      { title: 'Delivery Rider', salary: '$320/mo', location: 'Citywide', tone: 1 },
    ]},
    { variant: 'ticket', jobs: [
      { title: 'HR Generalist', salary: '$700/mo', location: 'Sen Sok', tone: 2 },
      { title: 'Customer Support', salary: '$500/mo', location: 'Remote', tone: 3 },
    ]},
  ]},
  { key: 'tech', title: 'Technology', rows: [
    { variant: 'standard', jobs: [
      { title: 'Backend Engineer', salary: '$1,500/mo', location: 'Remote', tone: 3 },
      { title: 'QA Tester', salary: '$650/mo', location: 'Toul Kork', tone: 1 },
      { title: 'IT Support', salary: '$550/mo', location: 'BKK3', tone: 4 },
    ]},
  ]},
  { key: 'sales', title: 'Sales & Marketing', rows: [
    { variant: 'standard', jobs: [
      { title: 'Field Sales Rep', salary: '$600/mo', location: 'Citywide', tone: 5 },
      { title: 'Brand Executive', salary: '$720/mo', location: 'Chamkarmon', tone: 2 },
      { title: 'Content Strategist', salary: '$800/mo', location: 'Remote', tone: 3 },
    ]},
  ]},
  { key: 'hospitality', title: 'Hospitality', rows: [
    { variant: 'large', jobs: [
      { title: 'Front Desk Supervisor', salary: '$680/mo', location: 'Riverside', tone: 4 },
      { title: 'Barista', salary: '$400/mo', location: 'BKK1', tone: 1 },
      { title: 'Housekeeper', salary: '$380/mo', location: 'Sen Sok', tone: 5 },
    ]},
  ]},
  { key: 'remote', title: 'Remote Opportunities', rows: [
    { variant: 'standard', jobs: [
      { title: 'Virtual Assistant', salary: '$450/mo', location: 'Remote', tone: 2 },
      { title: 'Copywriter', salary: '$550/mo', location: 'Remote', tone: 3 },
      { title: 'Data Entry Clerk', salary: '$350/mo', location: 'Remote', tone: 4 },
    ]},
  ]},
  { key: 'more', title: 'More Opportunities', rows: [
    { variant: 'standard', jobs: [
      { title: 'Security Guard', salary: '$300/mo', location: 'Citywide', tone: 5 },
      { title: 'Accountant', salary: '$700/mo', location: 'Daun Penh', tone: 1 },
      { title: 'Nanny', salary: '$420/mo', location: 'BKK2', tone: 2 },
    ]},
  ]},
];

function TwoColRow({ jobs }: { jobs: JobCardData[] }) {
  return (
    <View style={[styles.inset, styles.twoColRow]}>
      {jobs.map((job, i) => <JobCard key={i} variant="twoCol" job={job} />)}
    </View>
  );
}

function LargeSmallRow({ jobs }: { jobs: JobCardData[] }) {
  const [featured, ...rest] = jobs;
  return (
    <View style={[styles.inset, styles.lsWrap]}>
      <JobCard variant="large" job={featured} />
      <View style={styles.lsStack}>
        {rest.slice(0, 2).map((job, i) => <JobCard key={i} variant="small" job={job} />)}
      </View>
    </View>
  );
}

// Horizontal rows bleed to the screen edge (like the mockup's negative-margin
// trick) by living outside the section's horizontal padding and applying
// that padding to the scroll content instead.
function ScrollRow({ variant, jobs }: { variant: JobCardVariant; jobs: JobCardData[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
      {jobs.map((job, i) => <JobCard key={i} variant={variant} job={job} />)}
    </ScrollView>
  );
}

export function HomeScreen() {
  const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT_FALLBACK);

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.topPanel} onLayout={onHeaderLayout}>
        <HomeHeaderBackground height={headerHeight} />
        <View style={styles.locRow}>
          <View style={styles.locDot}><PinIcon size={13} color="#FFFFFF" /></View>
          <Text style={type.cityName}>Phnom Penh</Text>
        </View>
        <AnimatedSearchBar value="" onChangeText={() => {}} />
        <View style={{ height: spacing.afterSearchBar }} />
        <FinderButton />
        <View style={{ height: spacing.afterFinderBtn }} />
        <QuickSearchRow />
      </View>

      {SECTIONS.map((section, sIndex) => (
        <Animated.View
          key={section.key}
          entering={FadeInDown.delay(Math.min(sIndex, 8) * 40).duration(260)}
          style={styles.section}
        >
          <View style={styles.inset}>
            <View style={styles.divider} />
            <Text style={type.sectionTitle}>{section.title}</Text>
          </View>
          {section.rows.map((row, rIndex) => (
            <View key={rIndex} style={rIndex > 0 ? { marginTop: spacing.rowGap } : styles.firstRow}>
              {row.variant === 'featured' && (
                <View style={styles.inset}><JobCard variant="featured" job={row.jobs[0]} /></View>
              )}
              {row.variant === 'twoCol' && <TwoColRow jobs={row.jobs} />}
              {row.variant === 'large' && <LargeSmallRow jobs={row.jobs} />}
              {(row.variant === 'standard' || row.variant === 'ticket') && (
                <ScrollRow variant={row.variant} jobs={row.jobs} />
              )}
            </View>
          ))}
        </Animated.View>
      ))}
      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pageBg },
  topPanel: {
    paddingTop: spacing.headerPadTop,
    paddingBottom: spacing.headerPadBottom,
    paddingHorizontal: spacing.screenX,
    overflow: 'hidden',
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.afterLocRow },
  locDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },

  section: { paddingTop: spacing.sectionTop },
  inset: { paddingHorizontal: spacing.screenX },
  divider: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.green, opacity: 0.35, marginBottom: spacing.afterDivider },
  firstRow: { marginTop: spacing.afterTitle },

  twoColRow: { flexDirection: 'row', gap: spacing.cardGap },
  lsWrap: { flexDirection: 'row', gap: spacing.cardGap },
  lsStack: { flex: 1, gap: spacing.cardGap },
  scrollRow: { gap: spacing.cardGap, paddingHorizontal: spacing.screenX },
});
