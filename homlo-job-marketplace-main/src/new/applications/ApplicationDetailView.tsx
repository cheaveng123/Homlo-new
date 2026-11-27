import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, Extrapolation, FadeInDown, interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle,
  useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { JobPhoto } from './JobPhoto';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { StatePanel } from './StatePanel';
import { StateMessage } from './StateMessage';
import { StatusBadge } from './StatusBadge';
import { copy } from './copy';
import { formatAppliedLong } from './status';
import { cardShadow, colors, fonts, radii, SIDE_MARGIN } from './theme';
import type { ApplicationDetail, ApplicationFile } from './types';

export type ApplicationDetailViewProps = {
  state: 'loading' | 'error' | 'notFound' | 'ready';
  application?: ApplicationDetail;
  onBack: () => void;
  onRetry: () => void;
  onViewJob: () => void;
  onMessageEmployer: () => void;
  onFindSimilarJobs: () => void;
  onViewFile: (file: ApplicationFile) => void;
};

// Job photo: zooms in once on entry and drifts slower than the page while scrolling.
function Cover({ uri, title, scrollY }: { uri?: string | null; title: string; scrollY: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) enter.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [reduced, enter]);
  const img = useAnimatedStyle(() => {
    const y = scrollY.value;
    const pull = interpolate(y, [-120, 0], [1.25, 1], Extrapolation.CLAMP);
    const ty = interpolate(y, [0, 160], [0, 40], Extrapolation.CLAMP);
    return {
      opacity: 0.5 + 0.5 * enter.value,
      transform: [{ translateY: ty }, { scale: pull * (1.12 - 0.12 * enter.value) }],
    };
  });
  return (
    <View style={styles.coverShadow}>
      <View style={styles.cover}>
        <Animated.View style={[StyleSheet.absoluteFill, img]}>
          <JobPhoto uri={uri} title={title} fill />
        </Animated.View>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value, clay, first }: { icon: IconName; label: string; value: string; clay?: boolean; first?: boolean }) {
  return (
    <View style={[styles.drow, !first && styles.divider]}>
      <View style={styles.dLabel}>
        <Icon name={icon} size={20} color={colors.muted} />
        <Text style={styles.dLabelText}>{label}</Text>
      </View>
      <Text style={[styles.dValue, clay && { color: colors.clay }]}>{value}</Text>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton style={{ height: 160, borderRadius: radii.card }} />
      <Skeleton style={{ height: 28, width: '55%', marginTop: 14, marginBottom: 14 }} />
      <Skeleton style={{ height: 120, borderRadius: radii.card, marginBottom: 16 }} />
      <Skeleton style={{ height: 110, borderRadius: radii.card, marginBottom: 16 }} />
      <Skeleton style={{ height: 90, borderRadius: radii.card }} />
    </View>
  );
}

export function ApplicationDetailView(props: ApplicationDetailViewProps) {
  const { state, application: app, onBack, onRetry, onViewJob, onMessageEmployer, onFindSimilarJobs, onViewFile } = props;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(Math.min(i, 8) * 75).duration(450));

  const dateText = app ? formatAppliedLong(app.appliedAt) : null;
  const rows: { icon: IconName; label: string; value: string; clay?: boolean }[] = app ? [
    app.payLabel ? { icon: 'briefcase' as IconName, label: copy.pay, value: app.payLabel, clay: true } : null,
    app.typeLabel ? { icon: 'briefcase' as IconName, label: copy.type, value: app.typeLabel } : null,
    app.locationLabel ? { icon: 'pin' as IconName, label: copy.location, value: app.locationLabel } : null,
  ].filter((r): r is { icon: IconName; label: string; value: string; clay?: boolean } => r !== null) : [];
  const declined = app?.status === 'declined';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel={copy.back} style={styles.backBtn}>
          <Icon name="back" size={22} color={colors.deep} />
        </PressableScale>
        <Text style={styles.headerTitle}>{copy.applicationTitle}</Text>
      </View>

      {state === 'loading' ? <DetailSkeleton /> : null}
      {state === 'error' ? (
        <StateMessage icon="alert" title={copy.detailErrorTitle} body={copy.errorBody} actionLabel={copy.tryAgain} onAction={onRetry} />
      ) : null}
      {state === 'notFound' ? (
        <StateMessage icon="search" title={copy.notFoundTitle} body={copy.notFoundBody} actionLabel={copy.backToApplications} onAction={onBack} />
      ) : null}

      {state === 'ready' && app ? (
        <>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
          >
            <Animated.View entering={enter(0)}><Cover uri={app.jobImageUri} title={app.jobTitle} scrollY={scrollY} /></Animated.View>

            <Animated.View entering={enter(1)} style={styles.meta}>
              <Text style={styles.metaText}>{dateText ? `${copy.applied} ${dateText}` : ''}</Text>
              <StatusBadge status={app.status} />
            </Animated.View>

            <Animated.View entering={enter(2)} style={styles.section}><StatePanel status={app.status} /></Animated.View>

            <Animated.View entering={enter(3)} style={styles.section}>
              <View style={styles.card}>
                <View style={styles.jobRow}>
                  <JobPhoto uri={app.jobImageUri} title={app.jobTitle} size={64} radius={14} />
                  <View style={styles.jobTexts}>
                    <Text numberOfLines={2} style={styles.jobTitle}>{app.jobTitle}</Text>
                    {app.employerName ? <Text numberOfLines={1} style={styles.employer}>{app.employerName}</Text> : null}
                    {app.payLabel ? (
                      <View style={styles.payRow}>
                        <Icon name="briefcase" size={18} color={colors.clay} />
                        <Text style={styles.pay}>{app.payLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <PressableScale onPress={onViewJob} accessibilityRole="button" style={styles.outlineBtn}>
                  <Text style={styles.outlineText}>{copy.viewJob}</Text>
                </PressableScale>
              </View>
            </Animated.View>

            {app.message ? (
              <Animated.View entering={enter(4)}>
                <Section title={copy.yourApplication}>
                  <View style={styles.card}><Text style={styles.message}>{app.message}</Text></View>
                </Section>
              </Animated.View>
            ) : null}

            {app.files.length > 0 ? (
              <Animated.View entering={enter(5)}>
                <Section title={copy.filesYouSent}>
                  <View style={[styles.card, { paddingVertical: 4 }]}>
                    {app.files.map((f, i) => (
                      <View key={f.id} style={[styles.file, i > 0 && styles.divider]}>
                        <View style={styles.tile}><Icon name="file" size={22} color={colors.teal} /></View>
                        <View style={styles.fileTexts}>
                          <Text numberOfLines={1} style={styles.fileName}>{f.name}</Text>
                          {f.sizeLabel ? <Text style={styles.fileSize}>{f.sizeLabel}</Text> : null}
                        </View>
                        <PressableScale onPress={() => onViewFile(f)} accessibilityRole="button" hitSlop={{ top: 4, bottom: 4 }} style={styles.viewBtn}>
                          <Text style={styles.viewText}>{copy.view}</Text>
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                </Section>
              </Animated.View>
            ) : null}

            {rows.length > 0 ? (
              <Animated.View entering={enter(6)}>
                <Section title={copy.jobDetails}>
                  <View style={[styles.card, { paddingVertical: 2 }]}>
                    {rows.map((r, i) => <DetailRow key={r.label} first={i === 0} {...r} />)}
                  </View>
                </Section>
              </Animated.View>
            ) : null}

            <Animated.View entering={enter(7)}><Text style={styles.note}>{copy.footerNote}</Text></Animated.View>
          </Animated.ScrollView>

          <View style={[styles.bottom, { paddingBottom: 20 + insets.bottom }]}>
            <PressableScale
              onPress={declined ? onFindSimilarJobs : onMessageEmployer}
              accessibilityRole="button"
              style={styles.primaryBtn}
            >
              <Icon name={declined ? 'search' : 'chat'} size={20} color={colors.white} />
              <Text style={styles.primaryText}>{declined ? copy.findSimilarJobs : copy.messageEmployer}</Text>
            </PressableScale>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SIDE_MARGIN, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 26, color: colors.deep },
  content: { paddingHorizontal: SIDE_MARGIN, paddingTop: 4 },
  coverShadow: { borderRadius: radii.card, backgroundColor: colors.tint, ...cardShadow },
  cover: { height: 160, borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.tint },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, marginBottom: 12 },
  metaText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 24, color: colors.deep, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.card, padding: 12, ...cardShadow },
  jobRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  jobTexts: { flex: 1, minWidth: 0 },
  jobTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22, color: colors.text },
  employer: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pay: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: colors.clay },
  outlineBtn: { height: 48, borderRadius: radii.pill, borderWidth: 1.6, borderColor: colors.teal, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  outlineText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.teal },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.text },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  tile: { width: 44, height: 44, borderRadius: radii.chip, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  fileTexts: { flex: 1, minWidth: 0 },
  fileName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: colors.text },
  fileSize: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  viewBtn: { height: 36, paddingHorizontal: 14, borderRadius: radii.chip, borderWidth: 1.6, borderColor: colors.teal, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  viewText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.teal },
  drow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dLabelText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted },
  dValue: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: colors.text, flexShrink: 1, textAlign: 'right' },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', paddingHorizontal: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SIDE_MARGIN, paddingTop: 12, backgroundColor: 'rgba(244,248,248,0.96)' },
  primaryBtn: { height: 48, borderRadius: radii.pill, backgroundColor: colors.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: colors.teal, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});