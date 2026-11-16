import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QzCount, QzCta, QzDock, QzIcon, QzPress, QzText } from './plnQzx_bits';
import { QzJobsGlyph, QzPostsGlyph } from './plnQzx_glyphs';
import { QZ, qzShadow } from './plnQzx_tokens';
import type { PlnQzxCopy, PlnQzxPlan } from './plnQzx_types';

export type PlnQzxPlansViewProps = {
  plans: PlnQzxPlan[];            // whatever the existing data returns, any length
  currentPlanId: string;
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;   // existing selection handler
  onBack: () => void;                   // existing back handler
  onPrimary: () => void;                // existing upgrade / change handler
  formatPrice: (n: number) => string;   // existing price formatter
  copy: PlnQzxCopy;
};

function Switcher({ plans, selectedId, currentId, onSelect, fmt, current }: { plans: PlnQzxPlan[]; selectedId: string; currentId: string; onSelect: (id: string) => void; fmt: (n: number) => string; current: string }) {
  const rm = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, plans.findIndex((p) => p.id === selectedId));
  const seg = w ? (w - 8) / plans.length : 0;
  const x = useSharedValue(0);
  useEffect(() => { x.value = rm ? idx * seg : withSpring(idx * seg, { damping: 18, stiffness: 220 }); }, [idx, seg, rm, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={st.seg} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg ? <Animated.View style={[st.pill, { width: seg }, pill]} /> : null}
      {plans.map((p) => {
        const on = p.id === selectedId;
        return (
          <QzPress key={p.id} role="tab" selected={on} label={p.name} onPress={() => onSelect(p.id)} style={st.tab}>
            <QzText v="strong" color={on ? QZ.c.white : QZ.c.muted} numberOfLines={1}>{p.name}</QzText>
            <QzText v="tiny" color={on ? QZ.c.tint2 : QZ.c.muted} numberOfLines={1}>{p.id === currentId ? current : fmt(p.price)}</QzText>
          </QzPress>
        );
      })}
    </View>
  );
}

function Tear() {
  return (
    <View style={st.tearWrap}>
      <View style={st.tearLine} />
      <View style={[st.notch, { left: -QZ.sp.lg - 10 }]} />
      <View style={[st.notch, { right: -QZ.sp.lg - 10 }]} />
    </View>
  );
}

export function PlnQzxPlansView(p: PlnQzxPlansViewProps) {
  const ins = useSafeAreaInsets();
  const sel = p.plans.find((x) => x.id === p.selectedPlanId) ?? p.plans[0];
  if (!sel) return null;
  const same = sel.id === p.currentPlanId;
  const c = p.copy;
  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + QZ.sp.lg, paddingHorizontal: QZ.sp.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={st.top}>
          <QzPress onPress={p.onBack} label={c.backLabel} style={st.back}><QzIcon name="back" color={QZ.c.deep} size={20} /></QzPress>
        </View>
        <QzText v="h1" style={{ marginBottom: QZ.sp.sm }}>{c.title}</QzText>
        <QzText style={{ marginBottom: QZ.sp.xl }}>{c.subtitle}</QzText>

        <Switcher plans={p.plans} selectedId={sel.id} currentId={p.currentPlanId} onSelect={p.onSelectPlan} fmt={p.formatPrice} current={c.currentTag} />

        <Animated.View key={sel.id} entering={FadeInDown.duration(300)} style={[st.ticket, qzShadow]}>
          <View style={st.rowWrap}>
            <QzText v="lead">{sel.name}</QzText>
            {sel.popular ? <View style={st.tag}><QzText v="tiny" color={QZ.c.primary}>{c.popularTag}</QzText></View> : null}
            {same ? <View style={st.tag}><QzText v="tiny" color={QZ.c.primary}>{c.currentTag}</QzText></View> : null}
          </View>
          <QzText v="body" color={QZ.c.creamInk}>{sel.tagline}</QzText>
          <View style={st.priceRow}>
            <QzCount to={sel.price} format={p.formatPrice} v="h1" color={QZ.c.clay} />
            <QzText v="small" color={QZ.c.creamInk}>{c.perMonth}</QzText>
          </View>

          <View style={st.limits}>
            <View style={st.limit}><QzJobsGlyph /><QzCount to={sel.activeJobs} v="h1" color={QZ.c.deep} /><QzText v="small">{c.activeJobs}</QzText></View>
            <View style={st.limit}><QzPostsGlyph /><QzCount to={sel.postsPerMonth} v="h1" color={QZ.c.deep} /><QzText v="small">{c.postsPerMonth}</QzText></View>
          </View>

          <Tear />

          {sel.features.map((f, i) => (
            <Animated.View key={f.label} entering={FadeInDown.delay(80 + i * 45).duration(300)} style={[st.feat, !f.included && { opacity: 0.55 }]}>
              <QzIcon ring name={f.included ? 'checkRing' : 'dashRing'} color={f.included ? QZ.c.primary : QZ.c.muted} />
              <QzText v="body" color={QZ.c.creamInk} style={{ flex: 1 }}>{f.label}</QzText>
            </Animated.View>
          ))}
        </Animated.View>

        <View style={st.note}>
          <View style={st.noteIcon}><QzIcon ring name="info" color={QZ.c.deep} /></View>
          <QzText v="small" color={QZ.c.text} style={{ flex: 1 }}>{c.note}</QzText>
        </View>
      </ScrollView>

      <QzDock>
        <QzCta sweep disabled={same} label={same ? c.ctaCurrent : c.ctaChange(sel.name)} onPress={p.onPrimary} />
      </QzDock>
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: QZ.c.bg },
  top: { flexDirection: 'row', marginBottom: QZ.sp.lg },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: QZ.c.tint, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', backgroundColor: QZ.c.card, borderWidth: 1, borderColor: QZ.c.border, borderRadius: QZ.r.tile, padding: 4, marginBottom: QZ.sp.lg },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: QZ.r.chip, backgroundColor: QZ.c.deep },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ticket: { backgroundColor: QZ.c.cream, borderRadius: QZ.r.card, borderWidth: 1, borderColor: '#F3DFAE', padding: QZ.sp.xl },
  rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: QZ.sp.sm },
  tag: { backgroundColor: QZ.c.white, borderRadius: QZ.r.pill, paddingHorizontal: QZ.sp.md, paddingVertical: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: QZ.sp.sm, marginTop: QZ.sp.sm },
  limits: { flexDirection: 'row', gap: QZ.sp.md, marginTop: QZ.sp.lg },
  limit: { flex: 1, backgroundColor: QZ.c.white, borderRadius: QZ.r.tile, padding: QZ.sp.md, gap: QZ.sp.xs },
  tearWrap: { height: 20, justifyContent: 'center', marginVertical: QZ.sp.md },
  tearLine: { height: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: QZ.c.creamLine, borderRadius: 1, marginBottom: -2, overflow: 'hidden' },
  notch: { position: 'absolute', top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: QZ.c.bg },
  feat: { flexDirection: 'row', alignItems: 'flex-start', gap: QZ.sp.md, paddingVertical: QZ.sp.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: QZ.sp.md, backgroundColor: QZ.c.tint, borderRadius: QZ.r.tile, padding: QZ.sp.md, marginTop: QZ.sp.lg },
  noteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: QZ.c.sun, alignItems: 'center', justifyContent: 'center' },
});
