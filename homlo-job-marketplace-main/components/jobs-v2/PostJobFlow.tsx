import React, { ReactNode, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeIn, FadeInLeft, FadeInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, IconName } from './AppIcon';
import { CATEGORY_NAMES, categoryStyle } from './categories';
import { ArrangementPicker } from './ArrangementPicker';
import { BottomSheet } from './ui';
import { LocationMapPicker, type MapChange } from './post/LocationMapPicker';
import {
  BackGlyph, CheckGlyph, ChevronGlyph, CloseGlyph, DraftGlyph, EditGlyph, MinusGlyph, PhotoStepGlyph, PlaceGlyph,
  PlusGlyph, RemoteGlyph, ReviewStepGlyph, SearchPlaceGlyph, TipGlyph, UploadArt, WarnGlyph,
} from './post/PostJobIcons';
import { SectionIcon, type SectionIconName } from '@/src/components/icons/SectionIcons';
import { PressableScale, SMOOTH, useShake } from '@/src/design/motion';
import { PhotoPlaceholder } from '@/src/design/primitives';
import { palette, radii, shadows } from '@/src/design/tokens';
import { TextNew } from '@/src/new/components/TextNew';
import { familyNew } from '@/src/new/theme/fontsNew';
import { haptic } from '@/lib/haptics';
import {
  WEEK_DAYS, formatClock, formatWorkDays, formatWorkHours, isOvernight, shiftHours, type WeekDay,
} from '@/lib/work-time';

/* ───────────── types ───────────── */

export type JobType = 'part-time' | 'full-time' | 'volunteer' | 'weekends';
export type Arrangement = 'on-site' | 'hybrid' | 'remote';
export type SalaryPeriod = 'hourly' | 'monthly' | 'yearly';
export type PayMode = 'fixed' | 'range';

export type JobDraft = {
  name: string;
  category: string | null;
  type: JobType | null;
  arrangement: Arrangement | null;
  photoUri?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  /** Kept for older drafts; the flow no longer asks for a description. */
  description: string;
  requirements: string[];
  /** Work days ('mon'..'sun'). Empty + daysNA = not specified. */
  workDays: WeekDay[];
  daysNA: boolean;
  /** "HH:MM" 24h. Null + hoursNA = not specified. */
  clockIn: string | null;
  clockOut: string | null;
  hoursNA: boolean;
  /** Fixed: one amount (salaryMin === salaryMax). Range: salaryMin – salaryMax. */
  payMode: PayMode;
  salaryPeriod: SalaryPeriod;
  salaryMin: number;
  salaryMax: number;
  salaryTouched: boolean;
  positions: number;
  autoClose: boolean;
};

type Props = {
  initial?: Partial<JobDraft>;
  categories?: string[];
  /** Optional custom icon per category name (e.g. the 19 job-field glyphs). */
  renderCategoryIcon?: (name: string) => React.ReactNode;
  onSaveDraft: (draft: JobDraft) => void;
  onDiscard: () => void;
  onPublish: (draft: JobDraft) => void;
  /** Open your existing image picker; resolve with the chosen uri. */
  onPickPhoto?: () => Promise<string | undefined | void>;
  /** Replace the built-in map picker (LocationMapPicker on the app's current job map). */
  renderMap?: (args: { value: MapChange | null; onChange: (v: MapChange) => void }) => ReactNode;
  /** Replace the default step gating with your existing validation. */
  validate?: (step: number, draft: JobDraft) => boolean;
  suggestions?: string[];
};

/** Seven questions, then a review page before publishing. */
const QUESTIONS = 7;
const TOTAL = 8;
const LOCATION_STEP = 4;
const REVIEW = 8;

type StepMeta = { short: string; q: string; s: string; icon: SectionIconName | 'photo' | 'review'; optional?: boolean };

/** Text only. Wire to your i18n keys. */
const S = {
  steps: [
    { short: 'Basics', q: 'What are you hiring for?', s: 'Give the job a clear name and pick the field it belongs to. Seekers search by both.', icon: 'jobField' },
    { short: 'Work type', q: 'How will they work?', s: 'Choose the schedule and where the work happens.', icon: 'jobType' },
    { short: 'Photo', q: 'Add a job photo', s: 'A real photo of the workplace or the work gets noticed first.', icon: 'photo', optional: true },
    { short: 'Location', q: 'Where is the job?', s: 'Move the map so the pin sits on the workplace, or search for it.', icon: 'location' },
    { short: 'Work time', q: 'When do they work?', s: 'Pick the work days and the clock-in and clock-out time. Mark either N/A if it varies.', icon: 'recent' },
    { short: 'Pay', q: 'How much does it pay?', s: 'Set one fixed amount or a range. Listings that show pay get more applicants.', icon: 'pay' },
    { short: 'Positions', q: 'How many people do you need?', s: 'We can close the listing for you once everyone is hired.', icon: 'positions' },
    { short: 'Review', q: 'Review your job', s: 'Check everything once more. Tap any section to change it.', icon: 'review' },
  ] as StepMeta[],
  stepOf: (n: number) => `Step ${n} of ${TOTAL}`,
  next: 'Continue', review: 'Review job', post: 'Post job', backToReview: 'Back to review', saveDraft: 'Save draft',
  exitTitle: 'Leave this job post?',
  exitBody: 'Save it as a draft to finish later, or discard what you entered.',
  exitSave: 'Save as draft', exitDiscard: 'Discard post', exitKeep: 'Keep editing',
};

const TYPES: { key: JobType; label: string; hint: string; icon: IconName }[] = [
  { key: 'part-time', label: 'Part-time', hint: 'Shifts or fewer hours', icon: 'clock' },
  { key: 'full-time', label: 'Full-time', hint: 'A full working week', icon: 'brief' },
  { key: 'volunteer', label: 'Volunteer', hint: 'Helping for a cause', icon: 'heart' },
  { key: 'weekends', label: 'Weekends', hint: 'Saturday and Sunday', icon: 'cal' },
];
const ARRANGEMENTS: { key: Arrangement; label: string }[] = [
  { key: 'on-site', label: 'On-site' }, { key: 'hybrid', label: 'Hybrid' }, { key: 'remote', label: 'Remote' },
];
const PERIODS: { key: SalaryPeriod; label: string; suffix: string; per: string }[] = [
  { key: 'hourly', label: 'Hourly', suffix: '/h', per: 'per hour' },
  { key: 'monthly', label: 'Monthly', suffix: '/mo', per: 'per month' },
  { key: 'yearly', label: 'Yearly', suffix: '/yr', per: 'per year' },
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
const QUICK_POSITIONS = [1, 2, 3, 5, 10];
const NAME_HINT = 60;

const money = (n: number) => `$${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const EMPTY: JobDraft = {
  name: '', category: null, type: null, arrangement: null, address: '', description: '', requirements: [],
  workDays: [], daysNA: false, clockIn: null, clockOut: null, hoursNA: false, payMode: 'range',
  salaryPeriod: 'monthly', salaryMin: BOUNDS.monthly.lo, salaryMax: BOUNDS.monthly.hi, salaryTouched: false,
  positions: 1, autoClose: false,
};

type Errors = Partial<Record<'name' | 'category' | 'type' | 'arrangement' | 'address' | 'days' | 'hours' | 'salary', string>>;

/** Field errors for one step (empty object = the step is complete). */
function errorsFor(step: number, d: JobDraft): Errors {
  const e: Errors = {};
  switch (step) {
    case 1:
      if (!d.name.trim()) e.name = 'Give the job a name, e.g. "Barista".';
      if (!d.category) e.category = 'Pick the field this job belongs to.';
      break;
    case 2:
      if (!d.type) e.type = 'Choose a job type.';
      if (!d.arrangement) e.arrangement = 'Choose where the work happens.';
      break;
    case 4:
      if (d.arrangement !== 'remote' && !d.address.trim()) e.address = 'Place the pin on the map or type the address.';
      break;
    case 5:
      if (!d.daysNA && d.workDays.length === 0) e.days = 'Pick at least one day, or mark the days N/A.';
      if (!d.hoursNA && (!d.clockIn || !d.clockOut)) e.hours = 'Set both clock-in and clock-out, or mark the hours N/A.';
      else if (!d.hoursNA && d.clockIn === d.clockOut) e.hours = 'Clock-out must be different from clock-in.';
      break;
    case 6:
      if (d.payMode === 'range' && d.salaryMin >= d.salaryMax) e.salary = 'Make the maximum higher than the minimum, or switch to Fixed.';
      if (d.payMode === 'fixed' && d.salaryMin <= 0) e.salary = 'Enter the amount you will pay.';
      break;
  }
  return e;
}

/* ───────────── small parts ───────────── */

function StepIcon({ name, size = 26 }: { name: StepMeta['icon']; size?: number }) {
  if (name === 'photo') return <PhotoStepGlyph size={size} />;
  if (name === 'review') return <ReviewStepGlyph size={size} />;
  return <SectionIcon name={name} size={size} delay={80} />;
}

function ErrorLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Animated.View entering={FadeIn.duration(160)} style={st.errorLine} accessibilityLiveRegion="polite">
      <WarnGlyph size={14} />
      <TextNew variant="caption" weight="semibold" color={palette.danger} style={{ flex: 1 }}>{text}</TextNew>
    </Animated.View>
  );
}

function Label({ text, optional, right }: { text: string; optional?: boolean; right?: ReactNode }) {
  return (
    <View style={st.labelRow}>
      <TextNew variant="meta" weight="semibold" color={palette.ink}>{text}</TextNew>
      {optional ? <View style={st.optional}><TextNew variant="caption" weight="semibold" color={palette.slate}>Optional</TextNew></View> : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, error, counter, hint, maxHint, autoFocus,
}: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean;
  error?: string; counter?: boolean; hint?: string; maxHint?: number; autoFocus?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const over = maxHint != null && value.length > maxHint;
  return (
    <View style={{ marginTop: 18 }}>
      {label ? (
        <Label
          text={label}
          right={counter ? (
            <TextNew variant="caption" color={over ? palette.amberInk : palette.muted}>
              {maxHint != null ? `${value.length}/${maxHint}` : `${value.length}`}
            </TextNew>
          ) : null}
        />
      ) : null}
      <View style={[st.field, focus && st.fieldOn, !!error && st.fieldErr, multiline && { minHeight: 148, alignItems: 'flex-start' }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          multiline={multiline}
          autoFocus={autoFocus}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel={label ?? placeholder}
          style={[st.input, multiline && { minHeight: 124 }]}
        />
      </View>
      {error ? <ErrorLine text={error} /> : hint ? (
        <TextNew variant="caption" color={over ? palette.amberInk : palette.muted} style={{ marginTop: 6 }}>{hint}</TextNew>
      ) : null}
    </View>
  );
}

function SelectBadge({ on }: { on: boolean }) {
  return (
    <View style={[st.badge, on && st.badgeOn]}>
      {on ? <CheckGlyph size={12} /> : null}
    </View>
  );
}

/** Category tile: field glyph on a soft disc, label below; cyan ring + tint when selected. */
function CategoryTile({
  label, glyph, selected, onPress, width,
}: { label: string; glyph: ReactNode; selected: boolean; onPress: () => void; width: number }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      scale={0.97}
      style={[st.tile, { width }, selected && st.tileOn]}
    >
      <View style={[st.tileDisc, selected && { backgroundColor: palette.surface }]}>{glyph}</View>
      <TextNew variant="meta" weight="semibold" color={palette.ink} numberOfLines={2} style={{ marginTop: 10, paddingRight: 8 }}>{label}</TextNew>
      <View style={st.tileBadge}><SelectBadge on={selected} /></View>
    </PressableScale>
  );
}

/** Job type tile: icon, label and one line of help. */
function TypeTile({
  label, hint, icon, selected, onPress, width,
}: { label: string; hint: string; icon: IconName; selected: boolean; onPress: () => void; width: number }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${hint}`}
      style={[st.tile, { width, minHeight: 112 }, selected && st.tileOn]}
    >
      <View style={[st.tileDisc, selected && { backgroundColor: palette.cyan }]}>
        <AppIcon name={icon} size={20} color={selected ? '#fff' : palette.navy} />
      </View>
      <TextNew variant="body" heading weight="bold" color={palette.ink} style={{ marginTop: 10 }}>{label}</TextNew>
      <TextNew variant="caption" color={palette.muted} numberOfLines={1}>{hint}</TextNew>
      <View style={st.tileBadge}><SelectBadge on={selected} /></View>
    </PressableScale>
  );
}

/** Period switch with a sliding cyan indicator. */
function Segmented<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T | null; onChange: (k: T) => void }) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(0);
  const seg = w > 0 ? (w - 8) / options.length : 0;
  useEffect(() => {
    x.value = reduce ? idx * seg : withTiming(idx * seg, { duration: 260, easing: SMOOTH });
  }, [idx, seg, reduce, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={st.seg} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="radiogroup">
      {seg > 0 ? <Animated.View style={[st.segInd, { width: seg }, ind]} /> : null}
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={st.segItem}
          >
            <TextNew variant="meta" weight="semibold" color={on ? '#fff' : palette.slate}>{o.label}</TextNew>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-knob range slider (24px knob, 44px touch area, cyan fill). */
function RangeSlider({
  min, max, step, low, high, onChange, onDrag, single,
}: {
  min: number; max: number; step: number; low: number; high: number;
  onChange: (lo: number, hi: number) => void; onDrag: (d: boolean) => void;
  /** One knob (fixed pay): only `high` moves; the fill starts at the left end. */
  single?: boolean;
}) {
  const [w, setW] = useState(0);
  const usable = Math.max(1, w - 44);
  // Latest props for the gesture handlers, refreshed after each render
  // (not assigned during render).
  const live = useRef({ min, max, step, low, high, usable, onChange, onDrag });
  useLayoutEffect(() => {
    live.current = { min, max, step, low, high, usable, onChange, onDrag };
  });
  const startX = useRef(0);
  const [active, setActive] = useState<'low' | 'high' | null>(null);

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
        setActive(which);
        haptic.selection();
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const v = toV(clamp(startX.current + g.dx, 0, c.usable));
        if (which === 'low') c.onChange(Math.min(v, c.high), c.high);
        else c.onChange(c.low, Math.max(v, c.low));
      },
      onPanResponderRelease: () => { live.current.onDrag(false); setActive(null); },
      onPanResponderTerminate: () => { live.current.onDrag(false); setActive(null); },
    });
  // Created once; their handlers read the latest values from `live` at drag
  // time. PanResponder.create only stores the callbacks (none run during
  // render), which the compiler can't see, hence the targeted disables.
  // eslint-disable-next-line react-hooks/refs
  const [lowPan] = useState(() => make('low'));
  // eslint-disable-next-line react-hooks/refs
  const [highPan] = useState(() => make('high'));

  const posX = (v: number) => ((v - min) / (max - min)) * usable;
  const lx = posX(low);
  const hx = posX(high);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 44, justifyContent: 'center' }}>
      <View style={[st.rail, { left: 22, right: 22 }]} />
      <View style={[st.rail, { left: 22 + (single ? 0 : lx), width: Math.max(0, hx - (single ? 0 : lx)), backgroundColor: palette.cyan }]} />
      {single ? null : <View
        {...lowPan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`Minimum ${money(low)}`}
        style={[st.knobWrap, { left: lx }]}
      >
        <View style={[st.knob, active === 'low' && st.knobOn]} />
      </View>}
      <View
        {...highPan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={single ? `Amount ${money(high)}` : `Maximum ${money(high)}`}
        style={[st.knobWrap, { left: hx }]}
      >
        <View style={[st.knob, active === 'high' && st.knobOn]} />
      </View>
    </View>
  );
}

function MoneyBox({
  label, value, onCommit, suffix,
}: { label: string; value: number; onCommit: (n: number) => void; suffix: string }) {
  const [focus, setFocus] = useState(false);
  // Editable copy while focused; otherwise show the formatted value directly.
  const [txt, setTxt] = useState(String(value));
  const shown = focus ? txt : money(value).slice(1);
  return (
    <View style={{ flex: 1 }}>
      <TextNew variant="caption" weight="semibold" color={palette.muted} style={{ marginBottom: 6 }}>{label}</TextNew>
      <View style={[st.field, st.moneyField, focus && st.fieldOn]}>
        <TextNew variant="title" heading weight="bold" color={palette.slate}>$</TextNew>
        <TextInput
          value={shown}
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
          accessibilityLabel={`${label} pay`}
          style={[st.input, { fontFamily: familyNew.heading.bold, fontSize: 18 }]}
        />
        <TextNew variant="caption" color={palette.muted}>{suffix}</TextNew>
      </View>
    </View>
  );
}

/** One progress segment: fills cyan when done, amber while current, hatched grey when skipped. */
function Segment({ state }: { state: 'done' | 'current' | 'todo' | 'skipped' }) {
  const reduce = useReducedMotion();
  const target = state === 'done' || state === 'skipped' ? 1 : state === 'current' ? 0.5 : 0;
  const f = useSharedValue(target);
  useEffect(() => {
    f.value = reduce ? target : withTiming(target, { duration: 320, easing: SMOOTH });
  }, [target, reduce, f]);
  const fill = useAnimatedStyle(() => ({ width: `${f.value * 100}%` }));
  return (
    <View style={st.segTrack}>
      <Animated.View
        style={[
          st.segFill,
          { backgroundColor: state === 'current' ? palette.amber : state === 'skipped' ? palette.placeholderB : palette.cyan },
          fill,
        ]}
      />
    </View>
  );
}

function Header({
  step, furthest, skipped, onBack, onClose,
}: { step: number; furthest: number; skipped: number | null; onBack: () => void; onClose: () => void }) {
  const meta = S.steps[step - 1];
  return (
    <View>
      <View style={st.headerRow}>
        <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={st.circle}>
          <BackGlyph />
        </PressableScale>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TextNew variant="body" heading weight="bold" color={palette.ink}>Post a job</TextNew>
          <TextNew variant="caption" color={palette.muted} accessibilityLabel={S.stepOf(step)}>
            {`${S.stepOf(step)} · ${meta.short}`}
          </TextNew>
        </View>
        <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={st.circle}>
          <CloseGlyph />
        </PressableScale>
      </View>
      <View style={st.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: TOTAL, now: step }}>
        {Array.from({ length: TOTAL }, (_, k) => {
          const n = k + 1;
          const state = n === skipped ? 'skipped' : n === step ? 'current' : n < Math.max(step, furthest) ? 'done' : 'todo';
          return <Segment key={n} state={state} />;
        })}
      </View>
    </View>
  );
}

function Tip({ children }: { children: string }) {
  return (
    <View style={st.tip}>
      <TipGlyph size={18} />
      <TextNew variant="caption" color={palette.slate} style={{ flex: 1 }}>{children}</TextNew>
    </View>
  );
}

/** Review section: label, a summary, and an Edit link back to that question. */
function ReviewRow({
  title, onEdit, children, missing,
}: { title: string; onEdit: () => void; children: ReactNode; missing?: boolean }) {
  return (
    <PressableScale onPress={onEdit} scale={0.985} accessibilityRole="button" accessibilityLabel={`Edit ${title}`} style={[st.reviewRow, missing && st.reviewMissing]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextNew variant="caption" weight="semibold" color={missing ? palette.danger : palette.muted}>{title.toUpperCase()}</TextNew>
        <View style={{ marginTop: 4 }}>{children}</View>
      </View>
      <View style={st.editPill}>
        <EditGlyph size={14} />
        <TextNew variant="caption" weight="semibold" color={palette.cyanDeep}>Edit</TextNew>
      </View>
    </PressableScale>
  );
}

/* ───────────── work time parts ───────────── */

const DAY_SHORT: Record<WeekDay, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DAY_PRESETS: { label: string; days: WeekDay[] }[] = [
  { label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: 'Weekends', days: ['sat', 'sun'] },
  { label: 'Every day', days: [...WEEK_DAYS] },
];

/** "N/A" pill switch for an optional part of the work time. */
function NAToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => { haptic.selection(); onChange(!on); }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} not applicable`}
      style={[st.na, on && st.naOn]}
    >
      <View style={[st.naBox, on && st.naBoxOn]}>{on ? <CheckGlyph size={9} /> : null}</View>
      <TextNew variant="caption" weight="semibold" color={on ? '#fff' : palette.slate}>N/A</TextNew>
    </Pressable>
  );
}

/** Seven day tiles plus quick presets. */
function DayPicker({ value, disabled, onChange }: { value: WeekDay[]; disabled: boolean; onChange: (d: WeekDay[]) => void }) {
  const on = new Set(value);
  const toggle = (k: WeekDay) => {
    haptic.selection();
    const next = new Set(on);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange(WEEK_DAYS.filter((x) => next.has(x)));
  };
  const same = (a: WeekDay[]) => a.length === value.length && a.every((x) => on.has(x));
  return (
    <View style={disabled && { opacity: 0.4 }} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={st.days}>
        {WEEK_DAYS.map((k) => {
          const sel = on.has(k);
          return (
            <View key={k} style={{ flex: 1 }}>
              <PressableScale
                onPress={() => toggle(k)} scale={0.94}
                accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={DAY_SHORT[k]}
                style={[st.dayTile, sel && st.dayTileOn]}
              >
                <TextNew variant="caption" weight="semibold" color={sel ? '#fff' : palette.ink}>{DAY_SHORT[k]}</TextNew>
              </PressableScale>
            </View>
          );
        })}
      </View>
      <View style={[st.chips, { marginTop: 10 }]}>
        {DAY_PRESETS.map((p) => {
          const sel = same(p.days);
          return (
            <PressableScale
              key={p.label} onPress={() => { haptic.selection(); onChange(p.days); }}
              accessibilityRole="button" accessibilityState={{ selected: sel }}
              style={[st.chip, sel && st.qChipOn]}
            >
              <TextNew variant="caption" weight="semibold" color={sel ? '#fff' : palette.ink}>{p.label}</TextNew>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** One side of the shift: label, big time, tap to change. */
function TimeCard({ label, value, onPress, disabled, error }: { label: string; value: string | null; onPress: () => void; disabled: boolean; error?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        onPress={onPress} disabled={disabled}
        accessibilityRole="button" accessibilityLabel={`${label}: ${formatClock(value) ?? 'not set'}`}
        style={[st.timeCard, !!error && !value && st.fieldErr, disabled && { opacity: 0.4 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SectionIcon name="jobType" size={16} tone="mono" />
          <TextNew variant="caption" weight="semibold" color={palette.muted}>{label.toUpperCase()}</TextNew>
        </View>
        <TextNew variant="header" heading weight="extrabold" color={value ? palette.ink : palette.placeholderInk} style={{ marginTop: 6 }}>
          {formatClock(value) ?? '--:--'}
        </TextNew>
        <TextNew variant="caption" weight="semibold" color={palette.cyanDeep}>{value ? 'Change' : 'Set time'}</TextNew>
      </PressableScale>
    </View>
  );
}

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

/** Bottom sheet time picker: hour grid, quarter-hour minutes, AM/PM. Returns "HH:MM" (24h). */
function TimeSheet({
  visible, title, value, onClose, onDone,
}: { visible: boolean; title: string; value: string; onClose: () => void; onDone: (v: string) => void }) {
  const [h24, setH24] = useState(() => Number(value.slice(0, 2)));
  const [m, setM] = useState(() => Number(value.slice(3, 5)));
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const setHour12 = (h: number) => setH24((h % 12) + (pm ? 12 : 0));
  const setPm = (p: boolean) => setH24((h24 % 12) + (p ? 12 : 0));
  const out = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <TextNew variant="section" heading weight="extrabold" color={palette.ink}>{title}</TextNew>
      <TextNew style={st.timeBig} accessibilityLiveRegion="polite">{formatClock(out)}</TextNew>
      <TextNew variant="caption" weight="semibold" color={palette.muted} style={{ marginBottom: 8 }}>HOUR</TextNew>
      <View style={st.hourGrid}>
        {HOURS_12.map((h) => {
          const sel = h === h12;
          return (
            <Pressable
              key={h} onPress={() => { haptic.selection(); setHour12(h); }}
              accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={`${h} o'clock`}
              style={[st.hourCell, sel && st.hourCellOn]}
            >
              <TextNew variant="body" weight="semibold" color={sel ? '#fff' : palette.ink}>{String(h)}</TextNew>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <View style={{ flex: 1.4 }}>
          <TextNew variant="caption" weight="semibold" color={palette.muted} style={{ marginBottom: 8 }}>MINUTES</TextNew>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {MINUTES.map((x) => {
              const sel = x === m;
              return (
                <Pressable
                  key={x} onPress={() => { haptic.selection(); setM(x); }}
                  accessibilityRole="radio" accessibilityState={{ selected: sel }}
                  style={[st.hourCell, { flex: 1 }, sel && st.hourCellOn]}
                >
                  <TextNew variant="body" weight="semibold" color={sel ? '#fff' : palette.ink}>{`:${String(x).padStart(2, '0')}`}</TextNew>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <TextNew variant="caption" weight="semibold" color={palette.muted} style={{ marginBottom: 8 }}> </TextNew>
          <Segmented options={[{ key: 'am', label: 'AM' }, { key: 'pm', label: 'PM' }]} value={pm ? 'pm' : 'am'} onChange={(k) => setPm(k === 'pm')} />
        </View>
      </View>
      <PressableScale onPress={() => onDone(out)} accessibilityRole="button" style={[st.primary, { marginTop: 18 }]}>
        <TextNew variant="title" heading weight="bold" color="#fff">Done</TextNew>
      </PressableScale>
    </BottomSheet>
  );
}

/* ───────────── flow ───────────── */

export default function PostJobFlow({
  initial, categories = CATEGORY_NAMES, renderCategoryIcon, onSaveDraft, onDiscard, onPublish, onPickPhoto, renderMap, validate, suggestions = COMMON,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const scrollRef = useRef<ScrollView | null>(null);
  const { style: shakeStyle, shake } = useShake();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  /** Furthest step reached, so editing an earlier answer keeps later segments filled. */
  const [furthest, setFurthest] = useState(1);
  const [d, setD] = useState<JobDraft>({ ...EMPTY, ...initial });
  const [exitOpen, setExitOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [lock, setLock] = useState(false);
  const [reqText, setReqText] = useState('');
  /** Steps the employer tried to leave while incomplete: their errors stay visible. */
  const [tried, setTried] = useState<Set<number>>(() => new Set());
  /** Which clock the time sheet edits; the sheet remounts per field so it starts on that value. */
  const [timeFor, setTimeFor] = useState<'in' | 'out'>('in');
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeKey, setTimeKey] = useState(0);
  const openTime = (which: 'in' | 'out') => { setTimeFor(which); setTimeKey((k) => k + 1); setTimeOpen(true); };
  /** Opened from the review page: Continue returns there. */
  const [fromReview, setFromReview] = useState(false);
  const set = (p: Partial<JobDraft>) => setD((prev) => ({ ...prev, ...p }));

  const remote = d.arrangement === 'remote';
  const allCats = Array.isArray(categories) && categories.length > 0 ? categories : CATEGORY_NAMES;
  const errors = useMemo(() => errorsFor(step, d), [step, d]);
  const canNext = useMemo(() => {
    if (validate) return validate(step, d);
    return Object.keys(errors).length === 0;
  }, [step, d, errors, validate]);
  const showErr: Errors = tried.has(step) ? errors : {};
  const genericErr = tried.has(step) && !canNext && Object.keys(errors).length === 0 ? 'Complete this step to continue.' : undefined;

  const go = (to: number, direction: 1 | -1) => {
    setDir(direction);
    setStep(to);
    setFurthest((f) => Math.max(f, to));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goNext = () => {
    if (!canNext) {
      setTried((t) => new Set(t).add(step));
      shake();
      return;
    }
    haptic.light();
    if (step === REVIEW) return onPublish(d);
    if (fromReview) { setFromReview(false); return go(REVIEW, 1); }
    go(step === LOCATION_STEP - 1 && remote ? LOCATION_STEP + 1 : step + 1, 1); // location is skipped for remote jobs
  };
  const goBack = () => {
    if (fromReview) { setFromReview(false); return go(REVIEW, -1); }
    if (step === 1) return setExitOpen(true);
    go(step === LOCATION_STEP + 1 && remote ? LOCATION_STEP - 1 : step - 1, -1);
  };
  const editFromReview = (n: number) => {
    setFromReview(true);
    go(n, -1);
  };

  // Android back: always sees the latest step and open sheets.
  const onHardwareBack = useEffectEvent(() => {
    if (exitOpen) setExitOpen(false);
    else if (catsOpen) setCatsOpen(false);
    else goBack();
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onHardwareBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const bounds = BOUNDS[d.salaryPeriod];
  const period = PERIODS.find((p) => p.key === d.salaryPeriod)!;
  const colW = (width - 40 - 10) / 2;
  const shownCats = useMemo(() => {
    const first = allCats.slice(0, 6);
    if (d.category && !first.includes(d.category)) {
      if (first.length > 0) first[5] = d.category;
      else first.push(d.category);
    }
    return first;
  }, [allCats, d.category]);
  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return q ? allCats.filter((c) => c.toLowerCase().includes(q)) : allCats;
  }, [allCats, catQuery]);

  const glyphFor = (c: string) => renderCategoryIcon?.(c) ?? <AppIcon name={categoryStyle(c).icon} size={22} color={palette.navy} />;
  const typeLabel = TYPES.find((t) => t.key === d.type)?.label;
  const arrLabel = ARRANGEMENTS.find((a) => a.key === d.arrangement)?.label;
  const fixed = d.payMode === 'fixed';
  const payText = fixed ? money(d.salaryMin) : `${money(d.salaryMin)} – ${money(d.salaryMax)}`;
  const daysLabel = d.daysNA ? null : formatWorkDays(d.workDays);
  const hoursLabel = d.hoursNA ? null : formatWorkHours(d.clockIn, d.clockOut);
  const setPayMode = (mode: PayMode) => {
    if (mode === d.payMode) return;
    haptic.selection();
    if (mode === 'fixed') return set({ payMode: mode, salaryMax: d.salaryMin, salaryTouched: true });
    const b = BOUNDS[d.salaryPeriod];
    const lo = Math.min(d.salaryMin, b.max - b.step);
    set({ payMode: mode, salaryMin: lo, salaryMax: clamp(Math.max(d.salaryMax, lo + b.step * 6), lo + b.step, b.max), salaryTouched: true });
  };

  const addReq = (t: string) => {
    const v = t.trim();
    if (!v || d.requirements.includes(v)) return;
    haptic.selection();
    set({ requirements: [...d.requirements, v] });
  };

  const pickPhoto = async () => {
    const uri = await onPickPhoto?.();
    if (typeof uri === 'string') set({ photoUri: uri });
  };

  /** The job card as seekers will see it (photo, title, field, pay, type). */
  const preview = (
    <View style={[st.preview, shadows.card]}>
      <View style={st.previewPhoto}>
        {d.photoUri ? (
          <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <PhotoPlaceholder style={StyleSheet.absoluteFill} label="No photo" />
        )}
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {d.category ? <View style={st.previewGlyph}>{glyphFor(d.category)}</View> : null}
          <TextNew variant="title" heading weight="bold" color={palette.ink} numberOfLines={1} style={{ flex: 1 }}>
            {d.name.trim() || 'Job name'}
          </TextNew>
        </View>
        <TextNew variant="caption" color={palette.muted} numberOfLines={1}>
          {[d.category, arrLabel, typeLabel].filter(Boolean).join(' · ') || 'Field · arrangement · type'}
        </TextNew>
        {daysLabel || hoursLabel ? (
          <TextNew variant="caption" color={palette.slate} numberOfLines={1}>{[daysLabel, hoursLabel].filter(Boolean).join(' · ')}</TextNew>
        ) : null}
        {d.salaryTouched || step >= 6 ? (
          <View style={st.payPill}>
            <TextNew variant="caption" weight="semibold" color={palette.cyanDeep}>{`${payText}${period.suffix}`}</TextNew>
          </View>
        ) : null}
      </View>
    </View>
  );

  const body = (() => {
    switch (step) {
      case 1:
        return (
          <>
            <Field
              label="Job name"
              value={d.name}
              onChangeText={(t) => set({ name: t })}
              placeholder="e.g. Barista, Cashier, Delivery rider"
              error={showErr.name}
              counter
              maxHint={NAME_HINT}
              hint={d.name.length > NAME_HINT ? 'Shorter names are easier to read on job cards.' : 'Use the title people would search for.'}
            />
            <View style={{ marginTop: 22 }}>
              <Label
                text="Job field"
                right={(
                  <Pressable onPress={() => setCatsOpen(true)} hitSlop={8} accessibilityRole="button" style={st.linkRow}>
                    <TextNew variant="meta" weight="semibold" color={palette.cyanDeep}>{`All ${allCats.length}`}</TextNew>
                    <ChevronGlyph size={14} color={palette.cyanDeep} />
                  </Pressable>
                )}
              />
              <View style={st.grid}>
                {shownCats.map((c) => (
                  <CategoryTile
                    key={c} label={c} glyph={glyphFor(c)} selected={d.category === c} width={colW}
                    onPress={() => { haptic.selection(); set({ category: c }); }}
                  />
                ))}
              </View>
              <ErrorLine text={showErr.category} />
            </View>
          </>
        );
      case 2:
        return (
          <>
            <View style={{ marginTop: 18 }}>
              <Label text="Job type" />
              <View style={st.grid}>
                {TYPES.map((t) => (
                  <TypeTile
                    key={t.key} label={t.label} hint={t.hint} icon={t.icon} width={colW} selected={d.type === t.key}
                    onPress={() => { haptic.selection(); set({ type: t.key }); }}
                  />
                ))}
              </View>
              <ErrorLine text={showErr.type} />
            </View>
            <View style={{ marginTop: 22 }}>
              <Label text="Where they work" />
              <ArrangementPicker options={ARRANGEMENTS} value={d.arrangement} onChange={(k) => set({ arrangement: k })} />
              <ErrorLine text={showErr.arrangement} />
              {remote ? <Tip>Remote jobs skip the location question. Seekers anywhere can apply.</Tip> : null}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <View style={{ marginTop: 18 }}>
              <Label text="Job photo" optional />
              {d.photoUri ? (
                <View style={st.photoWrap}>
                  <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={st.photoActions}>
                    <PressableScale onPress={() => void pickPhoto()} accessibilityRole="button" style={st.photoBtn}>
                      <PhotoStepGlyph size={16} color={palette.navy} />
                      <TextNew variant="caption" weight="semibold" color={palette.ink}>Change</TextNew>
                    </PressableScale>
                    <PressableScale onPress={() => set({ photoUri: undefined })} accessibilityRole="button" style={st.photoBtn}>
                      <CloseGlyph size={14} color={palette.danger} />
                      <TextNew variant="caption" weight="semibold" color={palette.danger}>Remove</TextNew>
                    </PressableScale>
                  </View>
                </View>
              ) : (
                <PressableScale onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel="Add a photo" style={st.upload}>
                  <UploadArt size={64} />
                  <TextNew variant="title" heading weight="bold" color={palette.cyanDeep} style={{ marginTop: 8 }}>Add a photo</TextNew>
                  <TextNew variant="caption" color={palette.muted}>JPG or PNG · landscape looks best</TextNew>
                </PressableScale>
              )}
            </View>
            <View style={st.tipList}>
              {['Show the real workplace or the work itself', 'Bright and in focus, no text or logos', 'No photo? A clean placeholder is shown'].map((t) => (
                <View key={t} style={st.tipItem}>
                  <View style={st.tipCheck}><CheckGlyph size={10} color={palette.cyanDeep} /></View>
                  <TextNew variant="meta" color={palette.slate} style={{ flex: 1 }}>{t}</TextNew>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 18 }}>
              <Label text="Card preview" />
              {preview}
            </View>
          </>
        );
      case 4:
        return (
          <View style={{ marginTop: 18 }}>
            {renderMap ? (
              renderMap({
                value: d.latitude != null && d.longitude != null ? { address: d.address, latitude: d.latitude, longitude: d.longitude } : null,
                onChange: (v) => set({ address: v.address, latitude: v.latitude, longitude: v.longitude }),
              })
            ) : (
              <LocationMapPicker
                value={d.latitude != null && d.longitude != null ? { address: d.address, latitude: d.latitude, longitude: d.longitude } : null}
                onChange={(v) => set({ address: v.address, latitude: v.latitude, longitude: v.longitude })}
                onInteract={setLock}
              />
            )}
            <Field
              label="Address on your listing"
              value={d.address}
              onChangeText={(t) => set({ address: t })}
              placeholder="Street, district, city"
              error={showErr.address}
              hint="Filled from the pin. Add a floor, unit or landmark if it helps."
            />
          </View>
        );
      case 5: {
        const hrs = d.hoursNA ? null : shiftHours(d.clockIn, d.clockOut);
        return (
          <>
            <View style={st.wtCard}>
              <Label text="Work days" right={<NAToggle label="Work days" on={d.daysNA} onChange={(v) => set({ daysNA: v })} />} />
              {d.daysNA ? (
                <TextNew variant="meta" color={palette.muted}>{'Days vary. Your listing will say “Not specified”.'}</TextNew>
              ) : (
                <DayPicker value={d.workDays} disabled={false} onChange={(days) => set({ workDays: days })} />
              )}
              <ErrorLine text={showErr.days} />
            </View>

            <View style={st.wtCard}>
              <Label text="Clock in & clock out" right={<NAToggle label="Work hours" on={d.hoursNA} onChange={(v) => set({ hoursNA: v })} />} />
              {d.hoursNA ? (
                <TextNew variant="meta" color={palette.muted}>{'Hours vary. Your listing will say “Not specified”.'}</TextNew>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TimeCard label="Clock in" value={d.clockIn} onPress={() => openTime('in')} disabled={false} error={!!showErr.hours} />
                    <View style={{ transform: [{ rotate: '180deg' }] }}><BackGlyph size={18} color={palette.slate} /></View>
                    <TimeCard label="Clock out" value={d.clockOut} onPress={() => openTime('out')} disabled={false} error={!!showErr.hours} />
                  </View>
                  {hrs != null ? (
                    <View style={st.shiftNote}>
                      <TextNew variant="caption" weight="semibold" color={palette.cyanDeep}>
                        {isOvernight(d.clockIn, d.clockOut) ? `Overnight shift · ${hrs} h` : `${hrs} h shift`}
                      </TextNew>
                    </View>
                  ) : null}
                </>
              )}
              <ErrorLine text={showErr.hours} />
            </View>

            <View style={{ marginTop: 22 }}>
              <Label text="Requirements" optional right={d.requirements.length ? <TextNew variant="caption" color={palette.muted}>{`${d.requirements.length} added`}</TextNew> : null} />
              {d.requirements.map((r) => (
                <Animated.View key={r} entering={reduce ? undefined : FadeIn.duration(160)} style={st.reqRow}>
                  <View style={st.reqCheck}><CheckGlyph size={11} /></View>
                  <TextNew variant="body" color={palette.ink} style={{ flex: 1 }}>{r}</TextNew>
                  <Pressable
                    onPress={() => set({ requirements: d.requirements.filter((x) => x !== r) })}
                    hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${r}`}
                  >
                    <CloseGlyph size={16} color={palette.muted} />
                  </Pressable>
                </Animated.View>
              ))}
              <View style={[st.field, st.addRow]}>
                <TextInput
                  value={reqText}
                  onChangeText={setReqText}
                  onSubmitEditing={() => {
                    addReq(reqText);
                    setReqText('');
                  }}
                  returnKeyType="done"
                  placeholder="Add a requirement"
                  placeholderTextColor={palette.muted}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel="Add a requirement"
                  style={st.input}
                />
                <PressableScale
                  onPress={() => {
                    addReq(reqText);
                    setReqText('');
                  }}
                  disabled={!reqText.trim()}
                  accessibilityRole="button" accessibilityLabel="Add requirement"
                  style={[st.addBtn, !reqText.trim() && { backgroundColor: palette.pillIdle }]}
                >
                  <PlusGlyph size={16} color={reqText.trim() ? '#fff' : palette.muted} />
                </PressableScale>
              </View>
              <TextNew variant="caption" weight="semibold" color={palette.muted} style={{ marginTop: 14 }}>Quick add</TextNew>
              <View style={st.chips}>
                {suggestions.filter((x) => !d.requirements.includes(x)).slice(0, 6).map((x) => (
                  <PressableScale key={x} onPress={() => addReq(x)} accessibilityRole="button" accessibilityLabel={`Add ${x}`} style={st.chip}>
                    <PlusGlyph size={12} color={palette.cyanDeep} />
                    <TextNew variant="caption" weight="semibold" color={palette.ink}>{x}</TextNew>
                  </PressableScale>
                ))}
              </View>
            </View>
          </>
        );
      }
      case 6:
        return (
          <>
            <View style={{ marginTop: 18 }}>
              <Label text="Pay type" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {([
                  { key: 'fixed', label: 'Fixed', hint: 'One set amount' },
                  { key: 'range', label: 'Range', hint: 'A minimum and maximum' },
                ] as const).map((o) => {
                  const sel = d.payMode === o.key;
                  return (
                    <View key={o.key} style={{ flex: 1 }}>
                      <PressableScale
                        onPress={() => setPayMode(o.key)}
                        accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={`${o.label}. ${o.hint}`}
                        style={[st.modeCard, sel && st.tileOn]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <TextNew variant="body" heading weight="bold" color={palette.ink}>{o.label}</TextNew>
                          <SelectBadge on={sel} />
                        </View>
                        <View style={st.modeArt}>
                          {o.key === 'fixed' ? (
                            <View style={[st.modeBar, { width: '100%', backgroundColor: sel ? palette.cyan : palette.placeholderB }]}>
                              <View style={[st.modeDot, { right: -2 }]} />
                            </View>
                          ) : (
                            <View style={[st.modeBar, { marginLeft: '28%', width: '50%', backgroundColor: sel ? palette.cyan : palette.placeholderB }]}>
                              <View style={[st.modeDot, { left: -2 }]} />
                              <View style={[st.modeDot, { right: -2 }]} />
                            </View>
                          )}
                        </View>
                        <TextNew variant="caption" color={palette.muted}>{o.hint}</TextNew>
                      </PressableScale>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={{ marginTop: 18 }}>
              <Label text="Pay period" />
              <Segmented
                options={PERIODS}
                value={d.salaryPeriod}
                onChange={(k) => set({
                  salaryPeriod: k, salaryMin: BOUNDS[k].lo, salaryMax: fixed ? BOUNDS[k].lo : BOUNDS[k].hi, salaryTouched: true,
                })}
              />
            </View>
            <View style={[st.payCard, shadows.card]}>
              <TextNew variant="caption" weight="semibold" color={palette.muted}>{fixed ? 'FIXED PAY' : 'PAY RANGE'}</TextNew>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <TextNew variant="hero" heading weight="extrabold" color={palette.ink}>{payText}</TextNew>
                <TextNew variant="meta" color={palette.muted}>{period.per}</TextNew>
              </View>
              <View style={{ marginTop: 14 }}>
                {fixed ? (
                  <RangeSlider
                    key="fixed" single
                    min={bounds.min} max={bounds.max} step={bounds.step} low={bounds.min} high={d.salaryMin}
                    onChange={(_lo, hi) => set({ salaryMin: hi, salaryMax: hi, salaryTouched: true })} onDrag={setLock}
                  />
                ) : (
                  <RangeSlider
                    key="range"
                    min={bounds.min} max={bounds.max} step={bounds.step} low={d.salaryMin} high={d.salaryMax}
                    onChange={(lo, hi) => set({ salaryMin: lo, salaryMax: hi, salaryTouched: true })} onDrag={setLock}
                  />
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                <TextNew variant="caption" color={palette.muted}>{money(bounds.min)}</TextNew>
                <TextNew variant="caption" color={palette.muted}>{`${money(bounds.max)}${period.suffix}`}</TextNew>
              </View>
            </View>
            {fixed ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <MoneyBox
                  key={`amount-${d.salaryPeriod}`}
                  label="Amount" value={d.salaryMin} suffix={period.suffix}
                  onCommit={(n) => { const v = clamp(n, bounds.min, bounds.max); set({ salaryMin: v, salaryMax: v, salaryTouched: true }); }}
                />
              </View>
            ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <MoneyBox
                key={`min-${d.salaryPeriod}`}
                label="Minimum" value={d.salaryMin} suffix={period.suffix}
                onCommit={(n) => set({ salaryMin: clamp(n, bounds.min, d.salaryMax), salaryTouched: true })}
              />
              <MoneyBox
                key={`max-${d.salaryPeriod}`}
                label="Maximum" value={d.salaryMax} suffix={period.suffix}
                onCommit={(n) => set({ salaryMax: clamp(n, d.salaryMin, bounds.max), salaryTouched: true })}
              />
            </View>
            )}
            <ErrorLine text={showErr.salary} />
            <Tip>{d.type === 'volunteer' ? 'Volunteer role? Set the lowest amount, and mention any stipend or meals in the description.' : 'Seekers filter jobs by pay, so a realistic range brings better matches.'}</Tip>
          </>
        );
      case 7:
        return (
          <>
            <View style={[st.stepperCard, shadows.card]}>
              <PressableScale
                onPress={() => { haptic.selection(); set({ positions: Math.max(1, d.positions - 1) }); }}
                disabled={d.positions <= 1}
                accessibilityRole="button" accessibilityLabel="Fewer positions"
                style={[st.stepBtn, d.positions <= 1 && { opacity: 0.4 }]}
              >
                <MinusGlyph size={20} color={palette.navy} />
              </PressableScale>
              <View style={{ alignItems: 'center', minWidth: 96 }}>
                <TextNew style={st.count} accessibilityLabel={`${d.positions} positions`}>{d.positions}</TextNew>
                <TextNew variant="meta" color={palette.muted}>{d.positions === 1 ? 'person' : 'people'}</TextNew>
              </View>
              <PressableScale
                onPress={() => { haptic.selection(); set({ positions: Math.min(99, d.positions + 1) }); }}
                disabled={d.positions >= 99}
                accessibilityRole="button" accessibilityLabel="More positions"
                style={[st.stepBtn, { backgroundColor: palette.cyan }]}
              >
                <PlusGlyph size={20} color="#fff" />
              </PressableScale>
            </View>
            <View style={[st.chips, { justifyContent: 'center', marginTop: 14 }]}>
              {QUICK_POSITIONS.map((n) => {
                const on = d.positions === n;
                return (
                  <PressableScale
                    key={n} onPress={() => { haptic.selection(); set({ positions: n }); }}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={[st.chip, st.qChip, on && st.qChipOn]}
                  >
                    <TextNew variant="meta" weight="semibold" color={on ? '#fff' : palette.ink}>{String(n)}</TextNew>
                  </PressableScale>
                );
              })}
            </View>
            <View style={st.toggleCard}>
              <View style={{ flex: 1 }}>
                <TextNew variant="body" heading weight="bold" color={palette.ink}>Auto-close when filled</TextNew>
                <TextNew variant="caption" color={palette.muted}>
                  {`Closes the listing after ${d.positions} ${d.positions === 1 ? 'person is' : 'people are'} hired.`}
                </TextNew>
              </View>
              <Switch
                value={d.autoClose}
                onValueChange={(v) => { haptic.selection(); set({ autoClose: v }); }}
                trackColor={{ false: palette.placeholderB, true: palette.cyan }}
                thumbColor="#fff"
                ios_backgroundColor={palette.placeholderB}
                accessibilityLabel="Auto-close when filled"
              />
            </View>
          </>
        );
      default: {
        const missing = [1, 2, 4, 5, 6].filter((n) => Object.keys(errorsFor(n, d)).length > 0);
        return (
          <>
            <View style={{ marginTop: 18 }}>{preview}</View>
            {missing.length === 0 ? (
              <View style={st.ready}>
                <View style={st.readyDot}><CheckGlyph size={12} /></View>
                <TextNew variant="meta" weight="semibold" color={palette.cyanDeep} style={{ flex: 1 }}>Everything looks good. Ready to post.</TextNew>
              </View>
            ) : (
              <View style={[st.ready, { backgroundColor: palette.dangerTint }]}>
                <WarnGlyph size={18} />
                <TextNew variant="meta" weight="semibold" color={palette.danger} style={{ flex: 1 }}>
                  {`${missing.length} ${missing.length === 1 ? 'section needs' : 'sections need'} attention before posting.`}
                </TextNew>
              </View>
            )}
            <View style={{ gap: 10, marginTop: 14 }}>
              <ReviewRow title="Basics" onEdit={() => editFromReview(1)} missing={missing.includes(1)}>
                <TextNew variant="body" weight="semibold" color={palette.ink}>{d.name.trim() || 'No job name yet'}</TextNew>
                <TextNew variant="caption" color={palette.muted}>{d.category ?? 'No field chosen'}</TextNew>
              </ReviewRow>
              <ReviewRow title="Work type" onEdit={() => editFromReview(2)} missing={missing.includes(2)}>
                <TextNew variant="body" weight="semibold" color={palette.ink}>{[typeLabel, arrLabel].filter(Boolean).join(' · ') || 'Not chosen'}</TextNew>
              </ReviewRow>
              <ReviewRow title="Photo" onEdit={() => editFromReview(3)}>
                <TextNew variant="body" color={palette.ink}>{d.photoUri ? 'Photo added' : 'No photo (placeholder shown)'}</TextNew>
              </ReviewRow>
              <ReviewRow title="Location" onEdit={() => editFromReview(remote ? 2 : 4)} missing={missing.includes(4)}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {remote ? <RemoteGlyph size={20} /> : <PlaceGlyph size={18} color={palette.cyan} />}
                  <TextNew variant="body" color={palette.ink} numberOfLines={2} style={{ flex: 1 }}>
                    {remote ? 'Remote, no address needed' : d.address.trim() || 'No address yet'}
                  </TextNew>
                </View>
              </ReviewRow>
              <ReviewRow title="Work time" onEdit={() => editFromReview(5)} missing={missing.includes(5)}>
                <TextNew variant="body" weight="semibold" color={palette.ink}>{d.daysNA ? 'Days: not specified' : daysLabel ?? 'No days chosen'}</TextNew>
                <TextNew variant="caption" color={palette.muted}>{d.hoursNA ? 'Hours: not specified' : hoursLabel ?? 'No clock-in or clock-out yet'}</TextNew>
              </ReviewRow>
              <ReviewRow title="Requirements" onEdit={() => editFromReview(5)}>
                {d.requirements.length ? (
                  <View style={st.chips}>
                    {d.requirements.map((r) => (
                      <View key={r} style={[st.chip, { backgroundColor: palette.field, borderColor: palette.field }]}>
                        <TextNew variant="caption" color={palette.slate}>{r}</TextNew>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TextNew variant="body" color={palette.muted}>None added</TextNew>
                )}
              </ReviewRow>
              <ReviewRow title="Pay" onEdit={() => editFromReview(6)} missing={missing.includes(6)}>
                <TextNew variant="body" weight="semibold" color={palette.ink}>{`${payText} ${period.per}`}</TextNew>
                <TextNew variant="caption" color={palette.muted}>{fixed ? 'Fixed amount' : 'Pay range'}</TextNew>
              </ReviewRow>
              <ReviewRow title="Positions" onEdit={() => editFromReview(7)}>
                <TextNew variant="body" weight="semibold" color={palette.ink}>{`${d.positions} ${d.positions === 1 ? 'position' : 'positions'}`}</TextNew>
                <TextNew variant="caption" color={palette.muted}>{d.autoClose ? 'Closes automatically when filled' : 'Stays open until you close it'}</TextNew>
              </ReviewRow>
            </View>
          </>
        );
      }
    }
  })();

  const meta = S.steps[step - 1];
  const primaryLabel = step === REVIEW ? S.post : fromReview ? S.backToReview : step === QUESTIONS ? S.review : S.next;
  const entering = reduce ? undefined : (dir === 1 ? FadeInRight : FadeInLeft).duration(260).easing(SMOOTH);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Header step={step} furthest={furthest} skipped={remote ? LOCATION_STEP : null} onBack={goBack} onClose={() => setExitOpen(true)} />
      </View>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!lock}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 32 }}
      >
        <Animated.View key={step} entering={entering}>
          <View style={st.intro}>
            <View style={st.introIcon}><StepIcon name={meta.icon} size={28} /></View>
            <View style={{ flex: 1 }}>
              <TextNew variant="caption" weight="semibold" color={palette.cyanDeep}>
                {meta.optional ? `${meta.short.toUpperCase()} · OPTIONAL` : meta.short.toUpperCase()}
              </TextNew>
              <TextNew variant="header" heading weight="extrabold" color={palette.ink} accessibilityRole="header">{meta.q}</TextNew>
            </View>
          </View>
          <TextNew variant="body" color={palette.slate} style={{ marginTop: 8 }}>{meta.s}</TextNew>
          <Animated.View style={shakeStyle}>{body}</Animated.View>
          <ErrorLine text={genericErr} />
        </Animated.View>
      </ScrollView>

      <View style={[st.bar, { paddingBottom: 12 + insets.bottom }]}>
        <PressableScale onPress={() => onSaveDraft(d)} accessibilityRole="button" accessibilityLabel={S.saveDraft} style={st.draftBtn}>
          <DraftGlyph size={18} />
          <TextNew variant="meta" weight="semibold" color={palette.cyanDeep}>{S.saveDraft}</TextNew>
        </PressableScale>
        <View style={{ flex: 1 }}>
          <PressableScale
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            accessibilityState={{ disabled: !canNext }}
            style={[st.primary, step === REVIEW ? st.primaryPost : null, !canNext && st.primaryOff, canNext && shadows.lift]}
          >
            <TextNew variant="title" heading weight="bold" color="#fff">{primaryLabel}</TextNew>
            {step === REVIEW ? <CheckGlyph size={16} /> : <View style={{ transform: [{ rotate: '180deg' }] }}><BackGlyph size={18} color="#fff" /></View>}
          </PressableScale>
        </View>
      </View>

      <BottomSheet visible={exitOpen} onClose={() => setExitOpen(false)}>
        <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
          <View style={[st.introIcon, { width: 56, height: 56 }]}><DraftGlyph size={28} /></View>
          <TextNew variant="section" heading weight="extrabold" color={palette.ink} align="center" style={{ marginTop: 12 }}>{S.exitTitle}</TextNew>
          <TextNew variant="body" color={palette.muted} align="center" style={{ marginTop: 4, marginBottom: 18 }}>{S.exitBody}</TextNew>
        </View>
        <PressableScale
          onPress={() => { setExitOpen(false); onSaveDraft(d); }}
          accessibilityRole="button" style={[st.primary, { marginBottom: 10 }]}
        >
          <TextNew variant="title" heading weight="bold" color="#fff">{S.exitSave}</TextNew>
        </PressableScale>
        <PressableScale
          onPress={() => { setExitOpen(false); onDiscard(); }}
          accessibilityRole="button" style={[st.primary, st.dangerBtn, { marginBottom: 6 }]}
        >
          <TextNew variant="title" heading weight="bold" color={palette.danger}>{S.exitDiscard}</TextNew>
        </PressableScale>
        <Pressable onPress={() => setExitOpen(false)} accessibilityRole="button" style={{ paddingVertical: 12, alignItems: 'center' }}>
          <TextNew variant="body" weight="semibold" color={palette.cyanDeep}>{S.exitKeep}</TextNew>
        </Pressable>
      </BottomSheet>

      <TimeSheet
        key={timeKey}
        visible={timeOpen}
        title={timeFor === 'in' ? 'Clock in' : 'Clock out'}
        value={(timeFor === 'in' ? d.clockIn : d.clockOut) ?? (timeFor === 'in' ? '08:00' : '17:00')}
        onClose={() => setTimeOpen(false)}
        onDone={(v) => {
          setTimeOpen(false);
          set(timeFor === 'in' ? { clockIn: v } : { clockOut: v });
        }}
      />

      <BottomSheet visible={catsOpen} onClose={() => { setCatsOpen(false); setCatQuery(''); }}>
        <TextNew variant="section" heading weight="extrabold" color={palette.ink}>Choose a job field</TextNew>
        <View style={[st.field, st.catSearch]}>
          <SearchPlaceGlyph size={18} />
          <TextInput
            value={catQuery}
            onChangeText={setCatQuery}
            placeholder="Search fields"
            placeholderTextColor={palette.muted}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Search job fields"
            style={st.input}
          />
        </View>
        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={st.grid}>
            {filteredCats.map((c) => (
              <CategoryTile
                key={c} label={c} glyph={glyphFor(c)} selected={d.category === c} width={(width - 32 - 10) / 2}
                onPress={() => {
                  haptic.selection();
                  set({ category: c });
                  setCatsOpen(false);
                  setCatQuery('');
                }}
              />
            ))}
          </View>
          {filteredCats.length === 0 ? (
            <TextNew variant="body" color={palette.muted} align="center" style={{ paddingVertical: 24 }}>No field matches that search.</TextNew>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { backgroundColor: palette.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.pillIdle, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 4, marginTop: 12 },
  segTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: palette.line, overflow: 'hidden' },
  segFill: { height: '100%', borderRadius: 3 },

  intro: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  introIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: palette.cyanTint, alignItems: 'center', justifyContent: 'center' },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optional: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: radii.pill, backgroundColor: palette.pillIdle },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 16, borderRadius: radii.input,
    backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.line,
  },
  fieldOn: { borderColor: palette.cyan, backgroundColor: '#FBFEFF' },
  fieldErr: { borderColor: palette.danger, backgroundColor: '#FFFBFA' },
  input: { flex: 1, fontFamily: familyNew.body.medium, fontSize: 16, color: palette.ink, paddingVertical: 14, paddingHorizontal: 0 },
  errorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    padding: 14, borderRadius: radii.tile, borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.surface, minHeight: 104,
  },
  tileOn: { borderColor: palette.cyan, backgroundColor: '#F3FAFC' },
  tileDisc: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  tileBadge: { position: 'absolute', top: 12, right: 12 },
  badge: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.placeholderB, backgroundColor: palette.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: palette.cyan, borderColor: palette.cyan },

  seg: { flexDirection: 'row', backgroundColor: palette.pillIdle, borderRadius: radii.pill, padding: 4 },
  segInd: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radii.pill, backgroundColor: palette.navy },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40 },

  payCard: { marginTop: 16, padding: 16, borderRadius: radii.card, backgroundColor: palette.surface },
  rail: { position: 'absolute', top: 19, height: 6, borderRadius: 3, backgroundColor: palette.line },
  knobWrap: { position: 'absolute', top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: palette.surface, borderWidth: 3, borderColor: palette.cyan,
    shadowColor: palette.navy, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  knobOn: { borderColor: palette.navy, transform: [{ scale: 1.08 }] },
  moneyField: { gap: 6 },

  upload: {
    height: 190, borderRadius: radii.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.cyanSoft,
    backgroundColor: '#F3FAFC', alignItems: 'center', justifyContent: 'center',
  },
  photoWrap: { height: 210, borderRadius: radii.card, overflow: 'hidden', backgroundColor: palette.placeholderA },
  photoActions: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  tipList: { marginTop: 14, gap: 8 },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: palette.cyanTint, alignItems: 'center', justifyContent: 'center' },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: radii.input,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
  },

  preview: { borderRadius: radii.card, backgroundColor: palette.surface, overflow: 'hidden' },
  previewPhoto: { height: 130, backgroundColor: palette.placeholderA },
  previewGlyph: { width: 30, height: 30, borderRadius: 10, backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  payPill: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: palette.cyanTint },

  reqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: radii.input, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
  },
  reqCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.cyan, alignItems: 'center', justifyContent: 'center' },
  addRow: { paddingRight: 8 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.cyan, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.pill,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
  },
  qChip: { minWidth: 48, justifyContent: 'center' },
  qChipOn: { backgroundColor: palette.navy, borderColor: palette.navy },

  stepperCard: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18,
    borderRadius: radii.card, backgroundColor: palette.surface,
  },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.pillIdle, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: familyNew.heading.extrabold, fontSize: 48, lineHeight: 56, color: palette.ink, textAlign: 'center' },
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 16, borderRadius: radii.tile,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
  },

  ready: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: radii.input, backgroundColor: palette.cyanTint,
  },
  readyDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.cyan, alignItems: 'center', justifyContent: 'center' },
  reviewRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radii.tile, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line,
  },
  reviewMissing: { borderColor: palette.danger },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radii.pill, backgroundColor: palette.cyanTint,
  },

  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16,
    backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line,
  },
  draftBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: 16, borderRadius: radii.pill,
    backgroundColor: palette.cyanTint,
  },
  primary: {
    height: 52, borderRadius: radii.pill, backgroundColor: palette.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryPost: { backgroundColor: palette.navy },
  primaryOff: { backgroundColor: palette.cyanSoft },
  dangerBtn: { backgroundColor: palette.dangerTint },
  wtCard: { marginTop: 18, padding: 16, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  na: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: radii.pill,
    backgroundColor: palette.pillIdle,
  },
  naOn: { backgroundColor: palette.navy },
  naBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: palette.placeholderInk, alignItems: 'center', justifyContent: 'center' },
  naBoxOn: { borderColor: '#fff', backgroundColor: palette.amber },
  days: { flexDirection: 'row', gap: 6 },
  dayTile: { height: 46, borderRadius: 12, backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  dayTileOn: { backgroundColor: palette.cyan },
  timeCard: { padding: 14, borderRadius: radii.tile, backgroundColor: palette.field, borderWidth: 1.5, borderColor: palette.field },
  shiftNote: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: palette.cyanTint },
  timeBig: { fontFamily: familyNew.heading.extrabold, fontSize: 40, lineHeight: 48, color: palette.ink, textAlign: 'center', marginVertical: 12 },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hourCell: { width: '15%', flexGrow: 1, height: 44, borderRadius: 12, backgroundColor: palette.field, alignItems: 'center', justifyContent: 'center' },
  hourCellOn: { backgroundColor: palette.navy },
  modeCard: { padding: 14, borderRadius: radii.tile, borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.surface, gap: 8 },
  modeArt: { height: 14, justifyContent: 'center', marginVertical: 2 },
  modeBar: { height: 6, borderRadius: 3 },
  modeDot: { position: 'absolute', top: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.surface, borderWidth: 3, borderColor: palette.navy },
  catSearch: { marginTop: 12, marginBottom: 12, minHeight: 46, backgroundColor: palette.field, borderColor: palette.field },
});
