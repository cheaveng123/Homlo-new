import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QzBadge, QzCta, QzDock, QzIcon, QzPress, QzSpinner, QzText } from './plnQzx_bits';
import { QZ, qzShadow } from './plnQzx_tokens';
import type { PlnQzxCopy, PlnQzxPlan } from './plnQzx_types';

function Row({ label, value, i = 0 }: { label: string; value: string; i?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(i * 70).duration(300)} style={st.row}>
      <QzText v="body">{label}</QzText>
      <QzText v="strong" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</QzText>
    </Animated.View>
  );
}

function Frame({ children, dock, center }: { children: React.ReactNode; dock?: React.ReactNode; center?: boolean }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={[{ paddingTop: ins.top + QZ.sp.lg, paddingHorizontal: QZ.sp.lg, paddingBottom: 140 }, center && { paddingTop: ins.top + 96 }]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {dock ? <QzDock>{dock}</QzDock> : null}
    </View>
  );
}

/* ---------- 2. Confirm (no icons, plain rows) ---------- */
export type PlnQzxMethod = { id: string; label: string };
export function PlnQzxConfirmView(p: {
  plan: PlnQzxPlan; formatPrice: (n: number) => string; renewsLabel: string;
  methods: PlnQzxMethod[]; methodId: string; onMethod: (id: string) => void;
  onBack: () => void; onPay: () => void; copy: PlnQzxCopy;
}) {
  const c = p.copy;
  return (
    <Frame dock={<QzCta label={c.payCta(p.formatPrice(p.plan.price))} onPress={p.onPay} />}>
      <QzPress onPress={p.onBack} label={c.backLabel} style={st.back}><QzIcon name="back" color={QZ.c.deep} /></QzPress>
      <QzText v="h1" style={{ marginBottom: QZ.sp.sm }}>{c.confirmTitle(p.plan.name)}</QzText>
      <QzText style={{ marginBottom: QZ.sp.xl }}>{c.confirmSub}</QzText>
      <View style={[st.card, qzShadow]}>
        <Row label={c.rowPlan} value={p.plan.name} i={1} />
        <Row label={c.rowToday} value={p.formatPrice(p.plan.price)} i={2} />
        <Row label={c.rowRenews} value={p.renewsLabel} i={3} />
      </View>
      <QzText v="h2" style={{ marginTop: QZ.sp.xl, marginBottom: QZ.sp.md }}>{c.payWith}</QzText>
      {p.methods.map((m) => {
        const on = m.id === p.methodId;
        return (
          <QzPress key={m.id} role="radio" selected={on} label={m.label} onPress={() => p.onMethod(m.id)}
            style={[st.opt, on && { borderColor: QZ.c.primary, backgroundColor: QZ.c.tint }]}>
            <QzText v="strong" style={{ flex: 1 }}>{m.label}</QzText>
            <View style={[st.radio, on && { backgroundColor: QZ.c.primary, borderColor: QZ.c.primary }]}>
              {on ? <QzIcon name="check" size={14} color={QZ.c.white} /> : null}
            </View>
          </QzPress>
        );
      })}
    </Frame>
  );
}

/* ---------- 3. Processing ---------- */
export function PlnQzxProcessingView({ stepIndex, copy }: { stepIndex: 0 | 1 | 2; copy: PlnQzxCopy }) {
  const rm = useReducedMotion();
  const pr = useSharedValue(0);
  useEffect(() => { pr.value = rm ? (stepIndex + 1) / 3 : withTiming((stepIndex + 1) / 3, { duration: 900 }); }, [stepIndex, rm, pr]);
  const bar = useAnimatedStyle(() => ({ width: `${pr.value * 100}%` }));
  return (
    <Frame center>
      <View accessibilityRole="progressbar" accessibilityLabel={copy.procTitle} style={{ alignItems: 'center' }}>
        <QzSpinner size={56} w={5} />
        <QzText v="h1" style={{ marginTop: QZ.sp.xl, textAlign: 'center' }}>{copy.procTitle}</QzText>
        <QzText style={{ marginTop: QZ.sp.sm, textAlign: 'center' }}>{copy.procSub}</QzText>
        <View style={st.bar}><Animated.View style={[st.barFill, bar]} /></View>
        <View style={{ alignSelf: 'center', marginTop: QZ.sp.xl, gap: QZ.sp.md }}>
          {copy.procSteps.map((s, i) => (
            <View key={s} style={st.step}>
              {i < stepIndex ? <View style={st.stepDone}><QzIcon name="check" size={12} color={QZ.c.white} /></View>
                : i === stepIndex ? <QzSpinner size={20} w={2} /> : <View style={st.stepIdle} />}
              <QzText v={i === stepIndex ? 'strong' : 'body'}>{s}</QzText>
            </View>
          ))}
        </View>
      </View>
    </Frame>
  );
}

/* ---------- 4. Success ---------- */
export function PlnQzxSuccessView(p: {
  plan: PlnQzxPlan; paidWith: string; formatPrice: (n: number) => string;
  onPrimary: () => void; onSecondary: () => void; copy: PlnQzxCopy;
}) {
  const c = p.copy;
  return (
    <Frame center dock={<><QzCta label={c.okPrimary} onPress={p.onPrimary} /><QzCta tone="quiet" label={c.okSecondary} onPress={p.onSecondary} /></>}>
      <QzBadge tone="ok" />
      <QzText v="h1" style={{ textAlign: 'center' }}>{c.okTitle(p.plan.name)}</QzText>
      <QzText style={{ textAlign: 'center', marginTop: QZ.sp.sm, marginBottom: QZ.sp.xl }}>{c.okSub}</QzText>
      <View style={[st.card, qzShadow]}>
        <Row label={c.rowJobs} value={String(p.plan.activeJobs)} i={3} />
        <Row label={c.rowPosts} value={String(p.plan.postsPerMonth)} i={4} />
        <Row label={c.rowPaid} value={p.paidWith} i={5} />
        <Row label={c.rowAmount} value={p.formatPrice(p.plan.price)} i={6} />
      </View>
    </Frame>
  );
}

/* ---------- 5. Failure ---------- */
export function PlnQzxFailureView(p: { onRetry: () => void; onKeep: () => void; copy: PlnQzxCopy }) {
  const c = p.copy;
  return (
    <Frame center dock={<><QzCta label={c.failPrimary} onPress={p.onRetry} /><QzCta tone="quiet" label={c.failSecondary} onPress={p.onKeep} /></>}>
      <QzBadge tone="bad" />
      <QzText v="h1" style={{ textAlign: 'center' }}>{c.failTitle}</QzText>
      <QzText style={{ textAlign: 'center', marginTop: QZ.sp.sm }}>{c.failSub}</QzText>
      <View style={st.err} accessibilityRole="alert">
        <View style={st.errIcon}><QzIcon ring name="info" color={QZ.c.danger} /></View>
        <View style={{ flex: 1 }}>
          <QzText v="strong" color={QZ.c.danger}>{c.failReasonTitle}</QzText>
          <QzText v="small" color={QZ.c.danger}>{c.failReasonBody}</QzText>
        </View>
      </View>
    </Frame>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: QZ.c.bg },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: QZ.c.tint, alignItems: 'center', justifyContent: 'center', marginBottom: QZ.sp.lg },
  card: { backgroundColor: QZ.c.card, borderRadius: QZ.r.card, borderWidth: 1, borderColor: QZ.c.border, paddingHorizontal: QZ.sp.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: QZ.sp.md, paddingVertical: QZ.sp.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: QZ.c.border },
  opt: { flexDirection: 'row', alignItems: 'center', gap: QZ.sp.md, minHeight: 56, padding: QZ.sp.lg, borderRadius: QZ.r.tile, borderWidth: 1.5, borderColor: QZ.c.border, backgroundColor: QZ.c.card, marginBottom: QZ.sp.md },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: QZ.c.track, alignItems: 'center', justifyContent: 'center' },
  bar: { width: 220, height: 6, borderRadius: 3, backgroundColor: QZ.c.tint, overflow: 'hidden', marginTop: QZ.sp.xl },
  barFill: { height: 6, borderRadius: 3, backgroundColor: QZ.c.primary },
  step: { flexDirection: 'row', alignItems: 'center', gap: QZ.sp.md },
  stepDone: { width: 20, height: 20, borderRadius: 10, backgroundColor: QZ.c.primary, alignItems: 'center', justifyContent: 'center' },
  stepIdle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: QZ.c.track },
  err: { flexDirection: 'row', gap: QZ.sp.md, alignItems: 'flex-start', backgroundColor: QZ.c.dangerTint, borderRadius: QZ.r.tile, padding: QZ.sp.md, marginTop: QZ.sp.xl },
  errIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: QZ.c.white, alignItems: 'center', justifyContent: 'center' },
});
