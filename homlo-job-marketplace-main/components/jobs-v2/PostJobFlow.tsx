import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, Image, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Switch, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInRight, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconName } from './AppIcon';
import { CATEGORY_NAMES, categoryStyle } from './categories';
import { BottomSheet, Card, Chip, Dot, Press, PrimaryButton, RoundButton, Txt, ts } from './ui';
import { colors, font, radius } from './theme';

/* ───────────── types ───────────── */

export type JobType = 'part-time' | 'full-time' | 'weekends';
export type Arrangement = 'on-site' | 'hybrid' | 'remote';
export type SalaryPeriod = 'hourly' | 'monthly' | 'yearly';

export type JobDraft = {
  name: string;
  category: string | null;
  type: JobType | null;
  arrangement: Arrangement | null;
  photoUri?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description: string;
  requirements: string[];
  salaryPeriod: SalaryPeriod;
  salaryMin: number;
  salaryMax: number;
  salaryTouched: boolean;
  positions: number;
  autoClose: boolean;
};

type MapChange = { address: string; latitude: number; longitude: number };

type Props = {
  initial?: Partial<JobDraft>;
  categories?: string[];
  onSaveDraft: (draft: JobDraft) => void;
  onDiscard: () => void;
  onPublish: (draft: JobDraft) => void;
  /** Open your existing image picker; resolve with the chosen uri. */
  onPickPhoto?: () => Promise<string | undefined | void>;
  /** Render your existing interactive map picker. A static placeholder is shown if omitted. */
  renderMap?: (args: { value: MapChange | null; onChange: (v: MapChange) => void }) => ReactNode;
  /** Replace the default step gating with your existing validation. */
  validate?: (step: number, draft: JobDraft) => boolean;
  suggestions?: string[];
};

const TOTAL = 7;

/** Text only. Wire to your i18n keys. */
const S = {
  steps: [
    { q: 'Job name & category', s: 'What are you hiring for?' },
    { q: 'Type & arrangement', s: 'How will they work?' },
    { q: 'Job picture', s: 'Shown on your job card.' },
    { q: 'Location', s: 'Where is the job?' },
    { q: 'About the role', s: 'Describe it, then list requirements.' },
    { q: 'Salary', s: 'How much does this job pay?' },
    { q: 'Positions', s: 'How many people do you need?' },
  ],
  stepOf: (n: number) => `Step ${n} of ${TOTAL}`,
  next: 'Next', post: 'Post job', saveDraft: 'Save draft',
  exitTitle: 'Leave this job post?',
  exitBody: 'Save it as a draft to finish later, or discard what you entered.',
  exitSave: 'Save as draft', exitDiscard: 'Discard post', exitKeep: 'Keep editing',
};

const TYPES: { key: JobType; label: string; icon: IconName }[] = [
  { key: 'part-time', label: 'Part-time', icon: 'clock' },
  { key: 'full-time', label: 'Full-time', icon: 'brief' },
  { key: 'weekends', label: 'Weekends', icon: 'cal' },
];
const ARRANGEMENTS: { key: Arrangement; label: string }[] = [
  { key: 'on-site', label: 'On-site' }, { key: 'hybrid', label: 'Hybrid' }, { key: 'remote', label: 'Remote' },
];
const PERIODS: { key: SalaryPeriod; label: string; suffix: string }[] = [
  { key: 'hourly', label: 'Hourly', suffix: '/h' },
  { key: 'monthly', label: 'Monthly', suffix: '/mo' },
  { key: 'yearly', label: 'Yearly', suffix: '/yr' },
];
/** Slider bounds and default range per period. Change to match your existing limits. */
const BOUNDS: Record<SalaryPeriod, { min: number; max: number; step: number; lo: number; hi: number }> = {
  hourly: { min: 1, max: 50, step: 1, lo: 3, hi: 8 },
  monthly: { min: 100, max: 3000, step: 50, lo: 300, hi: 900 },
  yearly: { min: 1200, max: 36000, step: 100, lo: 4200, hi: 10800 },
};
const COMMON = [
  'Age 18 or older', 'Reliable and on time', 'Team player', 'Can speak English',
  'Experience', 'Own transport', 'Good communication', 'Flexible schedule',
];

const money = (n: number) => `$${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const EMPTY: JobDraft = {
  name: '', category: null, type: null, arrangement: null, address: '', description: '', requirements: [],
  salaryPeriod: 'monthly', salaryMin: BOUNDS.monthly.lo, salaryMax: BOUNDS.monthly.hi, salaryTouched: false,
  positions: 1, autoClose: false,
};

/* ───────────── small parts ───────────── */

function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.fld, focus && { borderColor: colors.teal }]}>
      {label ? <Txt style={[ts.caption, { fontSize: 11 }]}>{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: font.semi, fontSize: 16, color: colors.text, paddingVertical: 2, paddingHorizontal: 0 }}
      />
    </View>
  );
}

/** Selected state: teal ring plus a small saffron check. */
function Option({
  label, icon, selected, onPress, width,
}: { label: string; icon: IconName; selected: boolean; onPress: () => void; width?: number }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        width ? { width } : null,
        selected && { borderColor: colors.teal, borderWidth: 2.5, padding: 9 },
      ]}
    >
      <View style={styles.optDisc}>
        <AppIcon name={icon} size={18} color={colors.deepTeal} />
      </View>
      <Txt style={{ flex: 1, fontFamily: font.semi }} numberOfLines={1}>{label}</Txt>
      {selected ? (
        <View style={styles.check}>
          <AppIcon name="check" size={12} color={colors.deepTeal} strokeWidth={2.4} />
        </View>
      ) : null}
    </Press>
  );
}

function Segmented<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T | null; onChange: (k: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Press
            key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[styles.segItem, on && { backgroundColor: colors.deepTeal }]}
          >
            <Txt style={{ fontFamily: font.bold, fontSize: 12, color: on ? colors.white : colors.muted }}>{o.label}</Txt>
          </Press>
        );
      })}
    </View>
  );
}

/** Two-knob range slider (22px knob, 44px touch area, track color rail, teal fill). */
function RangeSlider({
  min, max, step, low, high, onChange, onDrag,
}: {
  min: number; max: number; step: number; low: number; high: number;
  onChange: (lo: number, hi: number) => void; onDrag: (d: boolean) => void;
}) {
  const [w, setW] = useState(0);
  const usable = Math.max(1, w - 44);
  const live = useRef({ min, max, step, low, high, usable, onChange, onDrag });
  live.current = { min, max, step, low, high, usable, onChange, onDrag };
  const startX = useRef(0);

  const toX = (v: number) => ((v - live.current.min) / (live.current.max - live.current.min)) * live.current.usable;
  const toV = (x: number) => {
    const c = live.current;
    const raw = c.min + (x / c.usable) * (c.max - c.min);
    return clamp(Math.round(raw / c.step) * c.step, c.min, c.max);
  };

  const make = (which: 'low' | 'high') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startX.current = toX(which === 'low' ? live.current.low : live.current.high);
        live.current.onDrag(true);
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const v = toV(clamp(startX.current + g.dx, 0, c.usable));
        if (which === 'low') c.onChange(Math.min(v, c.high), c.high);
        else c.onChange(c.low, Math.max(v, c.low));
      },
      onPanResponderRelease: () => live.current.onDrag(false),
      onPanResponderTerminate: () => live.current.onDrag(false),
    });
  const lowPan = useRef(make('low')).current;
  const highPan = useRef(make('high')).current;

  const lx = toX(low);
  const hx = toX(high);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 44, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 22, right: 22, top: 19, height: 6, borderRadius: 6, backgroundColor: colors.track }} />
      <View style={{ position: 'absolute', left: 22 + lx, width: Math.max(0, hx - lx), top: 19, height: 6, borderRadius: 6, backgroundColor: colors.teal }} />
      <View {...lowPan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Minimum" style={[styles.knobWrap, { left: lx }]}>
        <View style={styles.knob} />
      </View>
      <View {...highPan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Maximum" style={[styles.knobWrap, { left: hx }]}>
        <View style={styles.knob} />
      </View>
    </View>
  );
}

function MoneyBox({
  label, value, onCommit,
}: { label: string; value: number; onCommit: (n: number) => void }) {
  const [focus, setFocus] = useState(false);
  const [txt, setTxt] = useState(String(value));
  useEffect(() => {
    if (!focus) setTxt(money(value).slice(1));
  }, [value, focus]);
  return (
    <View style={[styles.fld, { flex: 1 }, focus && { borderColor: colors.teal }]}>
      <Txt style={[ts.caption, { fontSize: 11 }]}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt style={{ fontFamily: font.bold, fontSize: 16 }}>$</Txt>
        <TextInput
          value={txt}
          keyboardType="number-pad"
          onFocus={() => {
            setFocus(true);
            setTxt(String(value));
          }}
          onChangeText={(t) => setTxt(t.replace(/\D/g, ''))}
          onBlur={() => {
            setFocus(false);
            onCommit(parseInt(txt || '0', 10));
          }}
          maxFontSizeMultiplier={1.3}
          style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: colors.text, paddingVertical: 2, paddingHorizontal: 0 }}
        />
      </View>
    </View>
  );
}

function StepHeader({ step, onBack, onClose }: { step: number; onBack: () => void; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <RoundButton icon="back" label="Back" onPress={onBack} />
      <View style={styles.dots} accessibilityLabel={S.stepOf(step)}>
        {Array.from({ length: TOTAL }, (_, k) => (
          <Animated.View
            key={k}
            layout={LinearTransition.duration(200)}
            style={[
              styles.dotBar,
              k < step - 1 && { backgroundColor: colors.teal },
              k === step - 1 && { width: 24, backgroundColor: colors.sun },
            ]}
          />
        ))}
      </View>
      <RoundButton icon="x" label="Close" onPress={onClose} />
    </View>
  );
}

/* ───────────── flow ───────────── */

export default function PostJobFlow({
  initial, categories = CATEGORY_NAMES, onSaveDraft, onDiscard, onPublish, onPickPhoto, renderMap, validate, suggestions = COMMON,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [d, setD] = useState<JobDraft>({ ...EMPTY, ...initial });
  const [exitOpen, setExitOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [lock, setLock] = useState(false);
  const [reqText, setReqText] = useState('');
  const set = (p: Partial<JobDraft>) => setD((prev) => ({ ...prev, ...p }));

  const remote = d.arrangement === 'remote';
  const canNext = useMemo(() => {
    if (validate) return validate(step, d);
    switch (step) {
      case 1: return d.name.trim().length > 0 && !!d.category;
      case 2: return !!d.type && !!d.arrangement;
      case 4: return remote || d.address.trim().length > 0;
      case 5: return d.description.trim().length > 0;
      case 6: return d.salaryMin <= d.salaryMax;
      default: return true;
    }
  }, [step, d, remote, validate]);

  const goNext = () => {
    if (step === TOTAL) return onPublish(d);
    setStep(step === 3 && remote ? 5 : step + 1); // location is skipped for remote jobs
  };
  const goBack = () => {
    if (step === 1) return setExitOpen(true);
    setStep(step === 5 && remote ? 3 : step - 1);
  };

  const backRef = useRef(goBack);
  backRef.current = goBack;
  const stateRef = useRef({ exitOpen, catsOpen });
  stateRef.current = { exitOpen, catsOpen };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stateRef.current.exitOpen) setExitOpen(false);
      else if (stateRef.current.catsOpen) setCatsOpen(false);
      else backRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const bounds = BOUNDS[d.salaryPeriod];
  const suffix = PERIODS.find((p) => p.key === d.salaryPeriod)!.suffix;
  const colW = (width - 32 - 8) / 2;
  const shownCats = useMemo(() => {
    const cats = Array.isArray(categories) && categories.length > 0 ? categories : CATEGORY_NAMES;
    const first = cats.slice(0, 6);
    if (d.category && !first.includes(d.category)) {
      if (first.length > 0) first[5] = d.category;
      else first.push(d.category);
    }
    return first;
  }, [categories, d.category]);

  const addReq = (t: string) => {
    const v = t.trim();
    if (!v || d.requirements.includes(v)) return;
    set({ requirements: [...d.requirements, v] });
  };

  const body = (() => {
    switch (step) {
      case 1:
        return (
          <>
            <Field label="Job name" value={d.name} onChangeText={(t) => set({ name: t })} placeholder="e.g. Barista" />
            <Txt style={[ts.caption, { marginBottom: 8 }]}>Category</Txt>
            <View style={styles.grid}>
              {shownCats.map((c) => (
                <Option key={c} label={c} icon={categoryStyle(c).icon} selected={d.category === c} width={colW} onPress={() => set({ category: c })} />
              ))}
            </View>
            <Press onPress={() => setCatsOpen(true)} accessibilityRole="button" style={{ paddingVertical: 12 }}>
              <Txt style={{ fontFamily: font.bold, fontSize: 12, color: colors.teal }}>{`See all ${(categories && categories.length > 0) ? categories.length : CATEGORY_NAMES.length} categories`}</Txt>
            </Press>
          </>
        );
      case 2:
        return (
          <>
            {TYPES.map((t) => (
              <View key={t.key} style={{ marginBottom: 8 }}>
                <Option label={t.label} icon={t.icon} selected={d.type === t.key} onPress={() => set({ type: t.key })} />
              </View>
            ))}
            <Txt style={[ts.caption, { marginTop: 12 }]}>Arrangement</Txt>
            <Segmented options={ARRANGEMENTS} value={d.arrangement} onChange={(k) => set({ arrangement: k })} />
          </>
        );
      case 3:
        return (
          <>
            <Press
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              onPress={async () => {
                const uri = await onPickPhoto?.();
                if (typeof uri === 'string') set({ photoUri: uri });
              }}
              style={styles.upload}
            >
              {d.photoUri ? (
                <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <AppIcon name="cam" size={26} color={colors.deepTeal} />
                  <Txt style={{ fontFamily: font.bold, color: colors.deepTeal }}>Add a photo</Txt>
                  <Txt style={ts.caption}>JPG or PNG</Txt>
                </View>
              )}
            </Press>
            <Txt style={[ts.caption, { marginTop: 14, marginBottom: 6 }]}>Card preview</Txt>
            <Card>
              <View style={{ height: 56, borderRadius: radius.tile, overflow: 'hidden' }}>
                {d.photoUri ? (
                  <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={[colors.tintMid, colors.tint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Txt style={[ts.title, { flex: 1 }]} numberOfLines={1}>{d.name || 'Job name'}</Txt>
                {d.salaryTouched ? <Txt style={ts.tag}>{`${money(d.salaryMin)}–${money(d.salaryMax)}${suffix}`}</Txt> : null}
              </View>
              <Txt style={ts.caption}>
                {[ARRANGEMENTS.find((a) => a.key === d.arrangement)?.label, TYPES.find((t) => t.key === d.type)?.label].filter(Boolean).join(' · ')}
              </Txt>
            </Card>
          </>
        );
      case 4:
        return (
          <>
            {renderMap ? (
              <View style={{ marginTop: 12 }}>
                {renderMap({
                  value: d.latitude != null && d.longitude != null ? { address: d.address, latitude: d.latitude, longitude: d.longitude } : null,
                  onChange: (v) => set({ address: v.address, latitude: v.latitude, longitude: v.longitude }),
                })}
              </View>
            ) : (
              <View style={styles.map}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <React.Fragment key={i}>
                      <Line x1={i * 14} y1="0" x2={i * 14} y2="250" stroke={colors.tintMid} strokeWidth="1" />
                      <Line x1="0" y1={i * 14} x2="600" y2={i * 14} stroke={colors.tintMid} strokeWidth="1" />
                    </React.Fragment>
                  ))}
                </Svg>
                <View style={styles.mapSearch}>
                  <AppIcon name="search" size={16} color={colors.muted} />
                  <Txt style={{ color: colors.muted }}>Search a place</Txt>
                </View>
                <View style={styles.mapPin}>
                  <AppIcon name="pin" size={22} color={colors.white} />
                </View>
              </View>
            )}
            <Field label="Address · auto-filled, editable" value={d.address} onChangeText={(t) => set({ address: t })} placeholder="Street, district, city" />
          </>
        );
      case 5:
        return (
          <>
            <View style={{ marginVertical: 10 }}>
              <Field value={d.description} onChangeText={(t) => set({ description: t })} placeholder="Describe the job in a few lines…" multiline />
            </View>
            <Txt style={{ fontFamily: font.bold, fontSize: 12 }}>Requirements</Txt>
            {d.requirements.map((r) => (
              <View key={r} style={styles.bullet}>
                <Dot />
                <Txt style={{ flex: 1 }}>{r}</Txt>
                <Press onPress={() => set({ requirements: d.requirements.filter((x) => x !== r) })} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Remove ${r}`}>
                  <AppIcon name="x" size={14} color={colors.muted} />
                </Press>
              </View>
            ))}
            <View style={[styles.addRow]}>
              <TextInput
                value={reqText}
                onChangeText={setReqText}
                onSubmitEditing={() => {
                  addReq(reqText);
                  setReqText('');
                }}
                returnKeyType="done"
                placeholder="Add a requirement"
                placeholderTextColor={colors.muted}
                maxFontSizeMultiplier={1.3}
                style={{ flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.text, paddingVertical: 10 }}
              />
              {reqText.trim() ? (
                <Press
                  onPress={() => {
                    addReq(reqText);
                    setReqText('');
                  }}
                  hitSlop={8} accessibilityRole="button" accessibilityLabel="Add requirement"
                >
                  <Txt style={{ fontFamily: font.bold, fontSize: 12, color: colors.teal }}>Add</Txt>
                </Press>
              ) : null}
            </View>
            <Txt style={[ts.caption, { marginTop: 8 }]}>Common points</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>
              {suggestions.filter((x) => !d.requirements.includes(x)).slice(0, 6).map((x) => (
                <Chip key={x} label={`+ ${x}`} onPress={() => addReq(x)} />
              ))}
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Segmented
              options={PERIODS}
              value={d.salaryPeriod}
              onChange={(k) => set({ salaryPeriod: k, salaryMin: BOUNDS[k].lo, salaryMax: BOUNDS[k].hi, salaryTouched: true })}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MoneyBox
                label="Minimum" value={d.salaryMin}
                onCommit={(n) => set({ salaryMin: clamp(n, bounds.min, d.salaryMax), salaryTouched: true })}
              />
              <MoneyBox
                label="Maximum" value={d.salaryMax}
                onCommit={(n) => set({ salaryMax: clamp(n, d.salaryMin, bounds.max), salaryTouched: true })}
              />
            </View>
            <View style={{ marginTop: 16 }}>
              <RangeSlider
                min={bounds.min} max={bounds.max} step={bounds.step} low={d.salaryMin} high={d.salaryMax}
                onChange={(lo, hi) => set({ salaryMin: lo, salaryMax: hi, salaryTouched: true })} onDrag={setLock}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
              <Txt style={ts.caption}>{money(bounds.min)}</Txt>
              <Txt style={ts.caption}>{`${money(bounds.max)}${suffix}`}</Txt>
            </View>
          </>
        );
      default:
        return (
          <>
            <View style={styles.stepper}>
              <RoundButton icon="minus" label="Fewer positions" size={44} onPress={() => set({ positions: Math.max(1, d.positions - 1) })} />
              <Txt style={styles.count} accessibilityLabel={`${d.positions} positions`}>{d.positions}</Txt>
              <RoundButton icon="plus" label="More positions" size={44} onPress={() => set({ positions: Math.min(99, d.positions + 1) })} />
            </View>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt style={ts.title}>Auto-close when filled</Txt>
                <Txt style={ts.caption}>Closes the job after all positions are hired</Txt>
              </View>
              <Switch
                value={d.autoClose}
                onValueChange={(v) => set({ autoClose: v })}
                trackColor={{ false: colors.track, true: colors.teal }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.track}
                accessibilityLabel="Auto-close when filled"
              />
            </Card>
          </>
        );
    }
  })();

  const meta = S.steps[step - 1];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.card }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView
        scrollEnabled={!lock}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 24 }}
      >
        <StepHeader step={step} onBack={goBack} onClose={() => setExitOpen(true)} />
        <Animated.View key={step} entering={reduce ? undefined : FadeInRight.duration(220)}>
          <View style={styles.eyebrow}>
            <Txt style={{ fontFamily: font.bold, fontSize: 11, lineHeight: 15, color: colors.eyebrowInk }}>{S.stepOf(step)}</Txt>
          </View>
          <Txt style={[ts.hero, { color: colors.text, marginTop: 8 }]} accessibilityRole="header">{meta.q}</Txt>
          <Txt style={ts.caption}>{meta.s}</Txt>
          <View style={{ marginTop: 4 }}>{body}</View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
        <Press onPress={() => onSaveDraft(d)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 12 }}>
          <Txt style={{ fontFamily: font.bold, color: colors.teal }}>{S.saveDraft}</Txt>
        </Press>
        <PrimaryButton
          style={{ flex: 1 }}
          label={step === TOTAL ? S.post : S.next}
          icon={step === TOTAL ? 'check' : undefined}
          disabled={!canNext}
          onPress={goNext}
        />
      </View>

      <BottomSheet visible={exitOpen} onClose={() => setExitOpen(false)}>
        <Txt style={ts.section}>{S.exitTitle}</Txt>
        <Txt style={[ts.caption, { marginTop: 4, marginBottom: 14 }]}>{S.exitBody}</Txt>
        <PrimaryButton
          label={S.exitSave}
          onPress={() => {
            setExitOpen(false);
            onSaveDraft(d);
          }}
          style={{ marginBottom: 10 }}
        />
        <PrimaryButton
          label={S.exitDiscard}
          variant="danger"
          onPress={() => {
            setExitOpen(false);
            onDiscard();
          }}
          style={{ marginBottom: 10 }}
        />
        <Press onPress={() => setExitOpen(false)} accessibilityRole="button" style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Txt style={{ fontFamily: font.bold, fontSize: 13, color: colors.teal }}>{S.exitKeep}</Txt>
        </Press>
      </BottomSheet>

      <BottomSheet visible={catsOpen} onClose={() => setCatsOpen(false)}>
        <Txt style={[ts.section, { marginBottom: 12 }]}>Choose a category</Txt>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {(categories && categories.length > 0 ? categories : CATEGORY_NAMES).map((c) => (
              <Option
                key={c} label={c} icon={categoryStyle(c).icon} selected={d.category === c} width={colW}
                onPress={() => {
                  set({ category: c });
                  setCatsOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dots: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' },
  dotBar: { width: 8, height: 8, borderRadius: 8, backgroundColor: colors.track },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: colors.cream, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginTop: 14 },
  fld: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.tile, paddingVertical: 9, paddingHorizontal: 14, marginVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.card,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  optDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute', right: 8, top: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.sun,
    alignItems: 'center', justifyContent: 'center',
  },
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 999, padding: 4, marginVertical: 8 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999, minHeight: 36 },
  knobWrap: { position: 'absolute', top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.teal },
  upload: {
    height: 130, borderRadius: radius.hero, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.teal,
    backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 12,
  },
  map: { height: 250, borderRadius: radius.hero, backgroundColor: colors.tint, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  mapSearch: {
    position: 'absolute', top: 10, left: 10, right: 10, height: 44, borderRadius: 999, backgroundColor: colors.white,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
  },
  mapPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 20 },
  count: { fontFamily: font.head, fontSize: 44, lineHeight: 52, color: colors.text, minWidth: 64, textAlign: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16,
    backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
