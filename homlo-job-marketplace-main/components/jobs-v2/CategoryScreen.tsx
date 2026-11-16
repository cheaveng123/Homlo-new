import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { categoryStyle } from './categories';
import {
  Card, LogoTile, Parallax, Pill, Press, Reveal, ResultBar, RoundButton, ScreenScroll, Txt, ts,
} from './ui';
import { accents, colors, font, radius } from './theme';

export type CategoryJob = {
  id: string; title: string; company: string; pay: string; type: string; distance?: string; initials: string; color: string;
};
export type Employer = { id: string; initials: string; color: string };

type Props = {
  name: string;
  descriptor?: string;
  employers: Employer[];
  jobs: CategoryJob[];
  countLabel: string; // e.g. "128 jobs"
  onBack: () => void;
  onJobPress: (id: string) => void;
  onEmployerPress?: (id: string) => void;
  onFilters?: () => void;
  onSort?: () => void;
  strings?: { employers?: string; filters?: string; sort?: string };
};

/** One shared layout. Identity comes from the category's accent family and icon only (flat hero, no patterns). */
export default function CategoryScreen({
  name, descriptor, employers, jobs, countLabel, onBack, onJobPress, onEmployerPress, onFilters, onSort, strings,
}: Props) {
  const insets = useSafeAreaInsets();
  const cs = categoryStyle(name);
  const a = accents[cs.accent];

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <StatusBar style="dark" />
      <ScreenScroll>
        <View style={{ height: insets.top + 172, backgroundColor: a.bg, borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero }}>
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
            <RoundButton icon="back" label="Back" onPress={onBack} />
          </View>
          <Parallax rate={-0.3} fade={220} style={styles.heroRow}>
            <View style={[styles.disc, { backgroundColor: a.mid }]}>
              <AppIcon name={cs.icon} size={26} color={a.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={[ts.hero, { color: a.ink }]} accessibilityRole="header">{name}</Txt>
              <Txt style={{ color: a.ink }} numberOfLines={2}>{descriptor ?? cs.descriptor}</Txt>
            </View>
          </Parallax>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Txt style={[ts.section, { marginBottom: 10 }]}>{strings?.employers ?? 'Top employers hiring'}</Txt>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16, flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {employers.map((e) => (
              <Press key={e.id} onPress={() => onEmployerPress?.(e.id)} accessibilityRole="button">
                <LogoTile initials={e.initials} color={e.color} size={44} round />
              </Press>
            ))}
          </ScrollView>

          <View style={{ paddingTop: 16, paddingBottom: 12 }}>
            <ResultBar countLabel={countLabel} onFilters={onFilters} onSort={onSort} filtersLabel={strings?.filters} sortLabel={strings?.sort} />
          </View>

          {jobs.map((j) => (
            <Reveal key={j.id}>
              <Press onPress={() => onJobPress(j.id)} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <LogoTile initials={j.initials} color={j.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt style={ts.title} numberOfLines={1}>{j.title}</Txt>
                      <Txt style={ts.caption} numberOfLines={1}>{j.company}</Txt>
                    </View>
                    <Txt style={ts.tag}>{j.pay}</Txt>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <Pill label={j.type} bg={a.bg} ink={a.ink} />
                    {j.distance ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="pin" size={13} color={colors.muted} />
                        <Txt style={ts.caption}>{j.distance}</Txt>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </Press>
            </Reveal>
          ))}
        </View>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  disc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
