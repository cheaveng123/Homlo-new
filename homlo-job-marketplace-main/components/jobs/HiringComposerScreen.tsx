/**
 * HiringComposerScreen — employer "post a job" wizard, 7 steps.
 *
 * Mobile only. Presentation only: this component owns the step machine and the
 * draft object, and hands a finished `JobDraft` back to the route through
 * `onPublish` / `onSaveDraft` / `onDiscard`. The route owns persistence.
 *
 * Everything visual is sourced from the app's existing design system — see the
 * token/font sections below. Nothing here invents a colour, font or radius.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
  BackHandler,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInRight,
  FadeInLeft,
  FadeOutLeft,
  FadeOutRight,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
  LinearTransition,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { AppIcon, type IconName } from '@/components/ui/AppIcon';

import { fonts, familyForWeight } from '@/lib/typography';
import { jobCardTokens as card } from '@/components/jobs/jobCardTokens';
import { jobCategoryTheme } from '@/components/jobs/jobCategoryTheme';
import { JOB_FIELDS } from '@/lib/job-fields';
import { JobFieldArtwork } from '@/components/shared/JobFieldArtwork';
import OptionPickerSheet from '@/components/employer-job/OptionPickerSheet';
import { JobLocationPicker, type PickedAddress } from '@/components/JobLocationPicker';
import { pickerImageToJpegDataUrl } from '@/lib/profile-photo';

import { smooth } from '@/src/design/motion';
/* ───────────── tokens ─────────────
 * Mint/forest/gutter and the muted/line pair come from the job-card token files
 * so this screen stays in lockstep with the home feed. The three values marked
 * below have no equivalent token anywhere in the app, so they stay literal. */
const C = {
  forest: jobCategoryTheme.color.forest,
  mint: card.color.mint,
  m100: card.color.mintTint,
  soft: jobCategoryTheme.color.bgGutter,
  line: card.color.border,
  muted: card.color.muted,
  white: card.color.surface,
  shadow: card.color.shadow,
  placeholder: '#9AA8A0',
  // No theme token exists for these three; they are unique to this flow.
  sun: '#FFE9A8',
  sunInk: '#6B4E00',
  danger: '#D6453D',
};
const GUTTER = card.layout.gutter;
const R = jobCategoryTheme.radius;

/* The job banner is displayed at the home card's exact carousel box, so the
 * upload is cropped to that ratio and the preview can never lie about framing. */
const CARD_IMAGE_ASPECT = card.size.carouselWidth / card.size.carouselImageHeight;

/* ───────────── fonts ─────────────
 * `familyForWeight` resolves Inter only, so it backs the body weights and
 * `fonts.heading` supplies Plus Jakarta Sans for headings. */
const F = {
  h800: fonts.heading.extrabold,
  h700: fonts.heading.bold,
  b400: familyForWeight(400),
  b500: familyForWeight(500),
  b600: familyForWeight(600),
};
const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

/* ───────────── data ───────────── */
const TYPES: { name: string; icon: IconName }[] = [
  { name: 'Part-time', icon: 'clock' },
  { name: 'Full-time', icon: 'brief' },
  { name: 'Weekends', icon: 'calendar' },
];
const ARRANGEMENTS: { name: string; sub: string; icon: IconName }[] = [
  { name: 'On-site', sub: 'Work at the job location', icon: 'building' },
  { name: 'Hybrid', sub: 'Mix of on-site and remote', icon: 'arrow' },
  { name: 'Remote', sub: 'Work from anywhere', icon: 'laptop' },
];
const SUGGESTIONS = [
  'Age 18 or older',
  'Friendly and reliable',
  'Previous experience preferred',
  'Can work weekends',
  'Good communication',
  'Able to stand for long hours',
  'Khmer and basic English',
];
const PERIODS = {
  Hourly: { min: 1, max: 30, step: 1, unit: '/hr', lo: 4, hi: 10 },
  Monthly: { min: 100, max: 3000, step: 50, unit: '/mo', lo: 350, hi: 900 },
  Yearly: { min: 1200, max: 36000, step: 500, unit: '/yr', lo: 4200, hi: 10800 },
} as const;
type Period = keyof typeof PERIODS;
const STEPS = [
  ['Job details', 'Title and category'],
  ['Job type', 'How and where will they work?'],
  ['Job photo', 'Shown on the Homlo home page'],
  ['Location', 'Pin the spot or type the address'],
  ['About the role', 'Description and requirements'],
  ['Salary', 'How much does this job pay?'],
];
const TOTAL_STEPS = STEPS.length;

/** Tiles rendered before the "More" tile; the rest live in the picker sheet. */
const VISIBLE_FIELDS = JOB_FIELDS.slice(0, 11);

export type JobDraft = {
  title: string;
  category: string;
  type: string;
  arrangement: string;
  photoUri: string | null;
  address: string;
  pin: { lat: number; lng: number } | null;
  /**
   * Full reverse-geocoded result for the dropped pin. The route needs the
   * structured `city` / `district` / `street` parts, which cannot be recovered
   * from the display string once the user edits it.
   */
  picked: PickedAddress | null;
  description: string;
  requirements: string[];
  period: Period;
  salaryMin: number;
  salaryMax: number;
  positions: number;
  autoClose: boolean;
};

type Props = {
  initial?: Partial<JobDraft>;
  onPublish: (d: JobDraft) => void;
  onSaveDraft: (d: JobDraft) => void;
  onDiscard: () => void;
  /** True while the route is mid-save or mid-discard; disables the exit sheet. */
  busy?: boolean;
  /**
   * Whether a draft already exists server-side for this session. Only affects
   * the discard button's wording, which must promise the delete it performs.
   */
  hasSavedDraft?: boolean;
  /** Override the location picker. Receives the pin plus both pick callbacks. */
  renderMap?: (p: {
    pin: JobDraft['pin'];
    onPick: (lat: number, lng: number) => void;
    onPickAddress: (address: PickedAddress) => void;
  }) => React.ReactNode;
  /** Standalone fallback when no picker supplies a structured address. */
  reverseGeocode?: (lat: number, lng: number) => Promise<string>;
};

/* ───────────── small animated building blocks ───────────── */
const Rise = ({ i = 0, children }: { i?: number; children: React.ReactNode }) => (
  <Animated.View entering={FadeInDown.delay(60 + i * 70).duration(380).easing(SMOOTH)}>
    {children}
  </Animated.View>
);

const Label = ({ t, hint }: { t: string; hint?: string }) => (
  <View style={styles.lab}>
    <Text style={styles.labTx}>{t}</Text>
    {hint ? <Text style={styles.labHint}>{hint}</Text> : null}
  </View>
);

function Selectable({
  selected,
  onPress,
  style,
  children,
  selectedBg = C.m100,
}: {
  selected: boolean;
  onPress: () => void;
  style?: any;
  children: (s: boolean) => React.ReactNode;
  selectedBg?: string;
}) {
  const p = useSharedValue(selected ? 1 : 0);
  const s = useSharedValue(1);
  useEffect(() => {
    p.set(withTiming(selected ? 1 : 0, { duration: 240 }));
  }, [selected, p]);
  const a = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    backgroundColor: interpolateColor(p.value, [0, 1], [C.soft, selectedBg]),
    borderColor: interpolateColor(p.value, [0, 1], ['rgba(15,157,98,0)', C.mint]),
  }));
  return (
    <Pressable
      onPressIn={() => {
        s.set(smooth(0.95));
      }}
      onPressOut={() => {
        s.set(smooth(1));
      }}
      onPress={onPress}
    >
      <Animated.View style={[a, style]}>{children(selected)}</Animated.View>
    </Pressable>
  );
}

/**
 * Tile artwork. Field tiles use the app's own SVG per category rather than a
 * generic glyph, so a listing's category looks identical here and on the rail.
 */
function TileArt({
  field,
  on,
  size,
}: {
  field?: { title: string; svg: string };
  on: boolean;
  size: number;
}) {
  if (!field?.svg) return <AppIcon name="brief" size={size} color={on ? C.white : C.mint} />;
  return <JobFieldArtwork xml={field.svg} width={size} height={size} />;
}

const IconBubble = ({
  on,
  size = 38,
  selectedBg = C.mint,
  children,
}: {
  on: boolean;
  size?: number;
  selectedBg?: string;
  children: React.ReactNode;
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.34,
      backgroundColor: on ? selectedBg : C.white,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </View>
);

function PressScale({ onPress, disabled, style, children }: any) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        s.set(smooth(0.94));
      }}
      onPressOut={() => {
        s.set(smooth(1));
      }}
    >
      <Animated.View style={[a, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/* dual-thumb salary slider (gesture-handler + reanimated, UI-thread driven) */
function RangeSlider({
  min,
  max,
  step,
  lo,
  hi,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  lo: number;
  hi: number;
  onChange: (lo: number, hi: number) => void;
}) {
  const span = max - min;
  const w = useSharedValue(1);
  const a = useSharedValue((lo - min) / span);
  const b = useSharedValue((hi - min) / span);
  const sa = useSharedValue(0);
  const sb = useSharedValue(0);
  const ka = useSharedValue(1);
  const kb = useSharedValue(1);
  const gap = step / span;
  const last = useSharedValue(-1);

  const emit = (x: number, y: number) => onChange(x, y);
  const report = () => {
    'worklet';
    const x = Math.round((min + a.value * span) / step) * step;
    const y = Math.round((min + b.value * span) / step) * step;
    const key = x * 100000 + y;
    if (key !== last.value) {
      last.value = key;
      scheduleOnRN(emit, x, y);
    }
  };
  const gA = Gesture.Pan()
    .onBegin(() => {
      sa.value = a.value;
      ka.value = smooth(1.2);
    })
    .onUpdate((e) => {
      a.value = Math.min(Math.max(sa.value + e.translationX / w.value, 0), b.value - gap);
      report();
    })
    .onFinalize(() => {
      ka.value = smooth(1);
    });
  const gB = Gesture.Pan()
    .onBegin(() => {
      sb.value = b.value;
      kb.value = smooth(1.2);
    })
    .onUpdate((e) => {
      b.value = Math.min(Math.max(sb.value + e.translationX / w.value, a.value + gap), 1);
      report();
    })
    .onFinalize(() => {
      kb.value = smooth(1);
    });

  const fill = useAnimatedStyle(() => ({
    left: a.value * w.value,
    width: (b.value - a.value) * w.value,
  }));
  const tA = useAnimatedStyle(() => ({
    transform: [{ translateX: a.value * w.value - 15 }, { scale: ka.value }],
  }));
  const tB = useAnimatedStyle(() => ({
    transform: [{ translateX: b.value * w.value - 15 }, { scale: kb.value }],
  }));
  return (
    <View
      style={{ paddingHorizontal: 15, height: 40, justifyContent: 'center' }}
      onLayout={(e: LayoutChangeEvent) => {
        w.set(e.nativeEvent.layout.width - 30);
      }}
    >
      <View style={styles.rgTrack} />
      <Animated.View style={[styles.rgFill, fill, { marginLeft: 15 }]} />
      <GestureDetector gesture={gA}>
        <Animated.View style={[styles.rgThumb, tA]} hitSlop={12} />
      </GestureDetector>
      <GestureDetector gesture={gB}>
        <Animated.View style={[styles.rgThumb, tB]} hitSlop={12} />
      </GestureDetector>
    </View>
  );
}

/* home-page job card preview (live) */
function CardPreview({ d }: { d: JobDraft }) {
  const sal = `$${d.salaryMin.toLocaleString()}–$${d.salaryMax.toLocaleString()}${PERIODS[d.period].unit}`;
  return (
    <View style={styles.card}>
      <View style={styles.cardImg}>
        {d.photoUri ? (
          <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.cardImgEmpty}>
            <AppIcon name="brief" size={40} color={C.mint} />
          </View>
        )}
        <View style={styles.cardPill}>
          <Text style={styles.cardPillTx}>
            0/{d.positions} position{d.positions === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
      <View style={styles.cardTx}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {d.title || 'Your job title'}
          </Text>
          {d.arrangement !== 'Remote' ? (
            <View style={styles.cardLoc}>
              <AppIcon name="pin" size={13} color={C.muted} />
              <Text style={styles.cardLocTx} numberOfLines={1}>
                {d.address || 'Add a location'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardLoc}>
              <AppIcon name="laptop" size={13} color={C.muted} />
              <Text style={styles.cardLocTx}>Remote</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSal}>{sal}</Text>
      </View>
    </View>
  );
}

/* ───────────── exit sheet: Save as draft / Discard / Cancel ───────────── */
function ExitSheet({
  hasSavedDraft,
  onSave,
  onDiscard,
  onCancel,
  busy,
}: {
  hasSavedDraft: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(180)}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,59,46,0.45)' }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel="Keep editing"
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.grab} />
        <Text style={styles.sheetH}>Leave this job post?</Text>
        <Text style={styles.sheetSub}>
          Save it as a draft to finish later, or discard what you’ve entered.
        </Text>
        <PressScale onPress={onSave} disabled={busy} style={styles.cta}>
          <Text style={styles.ctaTx}>{busy ? 'Working…' : 'Save as draft'}</Text>
        </PressScale>
        <PressScale
          onPress={onDiscard}
          disabled={busy}
          style={[styles.cta, { backgroundColor: '#FCEBEA', marginTop: 10 }]}
        >
          <Text style={[styles.ctaTx, { color: C.danger }]}>
            {hasSavedDraft ? 'Discard and delete draft' : 'Discard'}
          </Text>
        </PressScale>
        <PressScale
          onPress={onCancel}
          disabled={busy}
          style={[styles.cta, { backgroundColor: C.soft, marginTop: 10 }]}
        >
          <Text style={[styles.ctaTx, { color: C.forest }]}>Cancel</Text>
        </PressScale>
      </Animated.View>
    </View>
  );
}

/* ───────────── main screen ───────────── */
export default function HiringComposerScreen({
  initial,
  onPublish,
  onSaveDraft,
  onDiscard,
  busy = false,
  hasSavedDraft = false,
  renderMap,
  reverseGeocode,
}: Props) {
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<JobDraft>(() => ({
    title: '',
    category: VISIBLE_FIELDS[0].title,
    type: 'Full-time',
    arrangement: 'On-site',
    photoUri: null,
    address: '',
    pin: null,
    picked: null,
    description: '',
    requirements: ['Age 18 or older'],
    period: 'Monthly',
    salaryMin: PERIODS.Monthly.lo,
    salaryMax: PERIODS.Monthly.hi,
    positions: 2,
    autoClose: true,
    ...initial,
  }));
  const set = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [exitOpen, setExitOpen] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const bar = useSharedValue(1 / TOTAL_STEPS);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` as any }));
  const canNext = step !== 0 || d.title.trim().length > 0;
  const dirty = d.title.trim().length > 0 || d.description.length > 0 || !!d.photoUri;

  const go = useCallback(
    (n: number) => {
      const t = Math.max(0, Math.min(TOTAL_STEPS - 1, n));
      setDir(t >= step ? 1 : -1);
      setStep(t);
      bar.set(withTiming((t + 1) / TOTAL_STEPS, { duration: 420, easing: SMOOTH }));
    },
    [step, bar],
  );
  const close = useCallback(
    () => (dirty ? setExitOpen(true) : onDiscard()),
    [dirty, onDiscard],
  );
  const next = () => (step === TOTAL_STEPS - 1 ? onPublish(d) : go(step + 1));

  // Android's hardware back used to leave the flow outright, silently throwing
  // away every answer. Route it through the same sheet the X button uses, and
  // let a second press dismiss that sheet (mirrors the previous wizard).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (categorySheet) {
        setCategorySheet(false);
        return true;
      }
      if (exitOpen) {
        setExitOpen(false);
        return true;
      }
      if (step > 0) {
        go(step - 1);
        return true;
      }
      close();
      return true;
    });
    return () => sub.remove();
  }, [step, exitOpen, categorySheet, go, close]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (r.canceled || !r.assets?.[0]) return;
    set('photoUri', await pickerImageToJpegDataUrl(r.assets[0], {
      maxWidth: 1600,
      aspect: {
        width: card.size.carouselWidth,
        height: card.size.carouselImageHeight,
      },
    }));
  };

  /** Structured pick: keep the reverse-geocoded parts for the save payload. */
  const onPickAddress = (a: PickedAddress) =>
    setD((p) => ({
      ...p,
      picked: a,
      pin: { lat: a.latitude, lng: a.longitude },
      address: a.formatted || a.street,
    }));

  /** Coordinate-only pick: fall back to the injected geocoder, if there is one. */
  const onPickCoords = async (lat: number, lng: number) => {
    setD((p) => ({
      ...p,
      pin: { lat, lng },
      address: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    }));
    if (reverseGeocode) {
      try {
        const a = await reverseGeocode(lat, lng);
        setD((p) => ({ ...p, address: a }));
      } catch {}
    }
  };

  const setPeriod = (p: Period) =>
    setD((x) => ({ ...x, period: p, salaryMin: PERIODS[p].lo, salaryMax: PERIODS[p].hi }));

  const mapNode = renderMap ? (
    renderMap({ pin: d.pin, onPick: (lat, lng) => void onPickCoords(lat, lng), onPickAddress })
  ) : (
    <JobLocationPicker onSelect={onPickAddress} />
  );

  const content = (() => {
    switch (step) {
      case 0:
        return (
          <>
            <Rise i={0}>
              <Label t="Job title" />
              <TextInput
                value={d.title}
                onChangeText={(v) => set('title', v)}
                placeholder="e.g. Barista"
                placeholderTextColor={C.placeholder}
                style={styles.input}
              />
            </Rise>
            <Rise i={1}>
              <Label t="Category" hint={`AI suggested: ${d.category}`} />
              <View style={styles.grid}>
                {VISIBLE_FIELDS.map((field) => (
                  <View key={field.id} style={styles.gridCell}>
                    <Selectable
                      selected={d.category === field.title}
                      onPress={() => set('category', field.title)}
                      style={styles.tile}
                      selectedBg={C.white}
                    >
                      {(on) => (
                        <>
                          <IconBubble on={on} size={64} selectedBg={C.white}>
                            <TileArt field={field} on={on} size={56} />
                          </IconBubble>
                          <Text style={styles.tileTx} numberOfLines={1}>
                            {field.title}
                          </Text>
                        </>
                      )}
                    </Selectable>
                  </View>
                ))}
                <View style={styles.gridCell}>
                  <PressScale onPress={() => setCategorySheet(true)} style={styles.tile}>
                    <IconBubble on={false} size={64}>
                      <AppIcon name="dots" size={40} color={C.mint} />
                    </IconBubble>
                    <Text style={styles.tileTx} numberOfLines={1}>
                      More
                    </Text>
                  </PressScale>
                </View>
              </View>
            </Rise>
          </>
        );
      case 1:
        return (
          <>
            <Rise i={0}>
              <Label t="Job type" />
              <View style={styles.row3}>
                {TYPES.map(({ name, icon }) => (
                  <View key={name} style={{ flex: 1 }}>
                    <Selectable
                      selected={d.type === name}
                      onPress={() => set('type', name)}
                      style={styles.tile}
                    >
                      {(on) => (
                        <>
                          <IconBubble on={on}>
                            <AppIcon name={icon} size={20} color={on ? C.white : C.mint} />
                          </IconBubble>
                          <Text style={styles.tileTx}>{name}</Text>
                        </>
                      )}
                    </Selectable>
                  </View>
                ))}
              </View>
            </Rise>
            <Rise i={1}>
              <Label t="Work arrangement" />
              <View style={{ gap: 8 }}>
                {ARRANGEMENTS.map(({ name, sub, icon }) => (
                  <Selectable
                    key={name}
                    selected={d.arrangement === name}
                    onPress={() => set('arrangement', name)}
                    style={styles.opt}
                  >
                    {(on) => (
                      <>
                        <IconBubble on={on} size={40}>
                          <AppIcon name={icon} size={20} color={on ? C.white : C.mint} />
                        </IconBubble>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optH}>{name}</Text>
                          <Text style={styles.optS}>{sub}</Text>
                        </View>
                      </>
                    )}
                  </Selectable>
                ))}
              </View>
            </Rise>
          </>
        );
      case 2:
        return (
          <>
            <Rise i={0}>
              <PressScale onPress={pickPhoto} style={styles.upload}>
                {d.photoUri ? (
                  <Image source={{ uri: d.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <AppIcon name="upload" size={30} color={C.mint} />
                    <Text style={[styles.optH, { marginTop: 8 }]}>Upload a photo</Text>
                    <Text style={styles.optS}>Shown at {Math.round(CARD_IMAGE_ASPECT * 100) / 100}:1 on job cards</Text>
                  </View>
                )}
              </PressScale>
            </Rise>
            <Rise i={1}>
              <Label t="Preview on Homlo home" hint="Updates live" />
              <CardPreview d={d} />
              <Text style={[styles.sub, { fontSize: 12, marginTop: 12 }]}>
                This is the exact crop job cards use, so anything outside the frame
                is trimmed away. Keep the subject centred.
              </Text>
            </Rise>
          </>
        );
      case 3:
        return (
          <>
            <Rise i={0}>{mapNode}</Rise>
            <Rise i={1}>
              <Label t="Address" hint="Auto-filled from pin" />
              <TextInput
                value={d.address}
                onChangeText={(v) => set('address', v)}
                placeholder="Street, district, city"
                placeholderTextColor={C.placeholder}
                style={styles.input}
              />
            </Rise>
          </>
        );
      case 4:
        return (
          <>
            <Rise i={0}>
              <Label t="Description" />
              <TextInput
                value={d.description}
                onChangeText={(v) => set('description', v)}
                multiline
                placeholder="What will the person do day to day?"
                placeholderTextColor={C.placeholder}
                style={[styles.input, { minHeight: 108, textAlignVertical: 'top' }]}
              />
            </Rise>
            <Rise i={1}>
              <Label t="Requirements" hint={`${d.requirements.filter(Boolean).length} added`} />
              <Animated.View layout={LinearTransition.duration(260)} style={{ gap: 8 }}>
                {d.requirements.map((r, i) => (
                  <Animated.View
                    key={i + '-' + d.requirements.length}
                    entering={FadeInDown.duration(260)}
                    exiting={FadeOutLeft.duration(200)}
                    layout={LinearTransition.duration(260)}
                    style={styles.bullet}
                  >
                    <View style={styles.dot} />
                    <TextInput
                      value={r}
                      onChangeText={(v) =>
                        set('requirements', d.requirements.map((x, j) => (j === i ? v : x)))
                      }
                      placeholder="Add a requirement"
                      placeholderTextColor={C.placeholder}
                      style={styles.bulletIn}
                    />
                    <Pressable
                      hitSlop={10}
                      onPress={() => set('requirements', d.requirements.filter((_, j) => j !== i))}
                      accessibilityLabel={`Remove requirement ${i + 1}`}
                    >
                      <AppIcon name="close" size={16} color={C.muted} />
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
              <PressScale
                onPress={() => set('requirements', [...d.requirements, ''])}
                style={[styles.chip, { marginTop: 10, alignSelf: 'flex-start' }]}
              >
                <AppIcon name="plus" size={15} color={C.mint} />
                <Text style={styles.chipTx}>Add requirement</Text>
              </PressScale>
            </Rise>
            <Rise i={2}>
              <Label t="Suggestions" />
              <Animated.View layout={LinearTransition.duration(260)} style={styles.chips}>
                {SUGGESTIONS.filter((s) => !d.requirements.includes(s)).map((s) => (
                  <Animated.View
                    key={s}
                    entering={ZoomIn.duration(220)}
                    exiting={ZoomOut.duration(160)}
                    layout={LinearTransition.duration(260)}
                  >
                    <PressScale
                      onPress={() =>
                        set('requirements', [...d.requirements.filter((x) => x.trim()), s])
                      }
                      style={styles.chip}
                    >
                      <AppIcon name="plus" size={14} color={C.mint} />
                      <Text style={styles.chipTx}>{s}</Text>
                    </PressScale>
                  </Animated.View>
                ))}
              </Animated.View>
            </Rise>
          </>
        );
      case 5: {
        const P = PERIODS[d.period];
        return (
          <>
            <Rise i={0}>
              <View style={styles.seg}>
                {(Object.keys(PERIODS) as Period[]).map((k) => (
                  <Pressable key={k} style={[styles.segBtn, d.period === k && styles.segOn]} onPress={() => setPeriod(k)}>
                    <Text style={[styles.segTx, d.period === k && { color: C.white }]}>{k}</Text>
                  </Pressable>
                ))}
              </View>
            </Rise>
            <Rise i={1}>
              <View style={styles.mm}>
                <View style={styles.mmBox}>
                  <Text style={styles.optS}>Minimum</Text>
                  <Text style={styles.mmNum}>${d.salaryMin.toLocaleString()}</Text>
                </View>
                <View style={styles.mmBox}>
                  <Text style={styles.optS}>Maximum</Text>
                  <Text style={styles.mmNum}>${d.salaryMax.toLocaleString()}</Text>
                </View>
              </View>
            </Rise>
            <Rise i={2}>
              <View style={{ marginTop: 20 }}>
                <RangeSlider
                  key={d.period}
                  min={P.min}
                  max={P.max}
                  step={P.step}
                  lo={d.salaryMin}
                  hi={d.salaryMax}
                  onChange={(lo, hi) => setD((p) => ({ ...p, salaryMin: lo, salaryMax: hi }))}
                />
                <View style={styles.between}>
                  <Text style={styles.optS}>${P.min.toLocaleString()}</Text>
                  <Text style={styles.optS}>
                    ${P.max.toLocaleString()}
                    {P.unit}
                  </Text>
                </View>
              </View>
            </Rise>
          </>
        );
      }

    }
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <PressScale onPress={() => (step === 0 ? close() : go(step - 1))} style={styles.round} accessibilityLabel="Back">
          <AppIcon name="back" size={20} color={C.forest} />
        </PressScale>
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>
        <Text style={styles.cnt}>
          {step + 1} / {TOTAL_STEPS}
        </Text>
        <PressScale onPress={close} style={styles.round} accessibilityLabel="Close">
          <AppIcon name="close" size={20} color={C.forest} />
        </PressScale>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View
            key={step}
            style={StyleSheet.absoluteFill}
            entering={(dir > 0 ? FadeInRight : FadeInLeft).duration(340).easing(SMOOTH)}
            exiting={(dir > 0 ? FadeOutLeft : FadeOutRight).duration(200)}
          >
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: GUTTER,
                paddingTop: 14,
                paddingBottom: 24,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.h}>{STEPS[step][0]}</Text>
              <Text style={styles.sub}>{STEPS[step][1]}</Text>
              {content}
            </ScrollView>
          </Animated.View>
        </View>
        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <PressScale
            onPress={next}
            disabled={!canNext}
            style={[styles.cta, !canNext && { backgroundColor: C.m100 }]}
          >
            <Text style={[styles.ctaTx, !canNext && { color: C.muted }]}>
              {step === TOTAL_STEPS - 1 ? 'Post job' : 'Continue'}
            </Text>
            {step === TOTAL_STEPS - 1 ? (
              <AppIcon name="check" size={18} color={C.white} />
            ) : (
              <AppIcon name="arrow" size={18} color={canNext ? C.white : C.muted} />
            )}
          </PressScale>
        </View>
      </KeyboardAvoidingView>

      {categorySheet ? (
        <OptionPickerSheet
          visible
          title="All categories"
          options={JOB_FIELDS.map((f) => f.title)}
          selected={d.category}
          onSelect={(value) => {
            set('category', value);
            setCategorySheet(false);
          }}
          onClose={() => setCategorySheet(false)}
        />
      ) : null}

      {exitOpen ? (
        <ExitSheet
          busy={busy}
          hasSavedDraft={hasSavedDraft}
          onCancel={() => setExitOpen(false)}
          onSave={() => onSaveDraft(d)}
          onDiscard={onDiscard}
        />
      ) : null}
    </View>
  );
}

/* ───────────── styles ───────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.line,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: C.mint },
  cnt: { fontFamily: F.b500, fontSize: 13, color: C.muted, minWidth: 34, textAlign: 'right' },
  h: { fontFamily: F.h800, fontSize: 28, color: C.forest, letterSpacing: -0.5 },
  sub: { fontFamily: F.b400, fontSize: 15, color: C.muted, marginTop: 6, marginBottom: 6 },
  lab: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  labTx: { fontFamily: F.b600, fontSize: 13, color: C.forest },
  labHint: { fontFamily: F.b400, fontSize: 12, color: C.muted },
  input: {
    backgroundColor: C.soft,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontFamily: F.b500,
    fontSize: 15,
    color: C.forest,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  gridCell: { width: '25%', padding: 4 },
  row3: { flexDirection: 'row', gap: 8 },
  tile: {
    borderRadius: R.lg,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 7,
  },
  tileTx: { fontFamily: F.b500, fontSize: 11, color: C.forest },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optH: { fontFamily: F.b600, fontSize: 14, color: C.forest },
  optS: { fontFamily: F.b400, fontSize: 12, color: C.muted, marginTop: 1 },
  upload: {
    aspectRatio: CARD_IMAGE_ASPECT,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: C.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImg: { aspectRatio: CARD_IMAGE_ASPECT, backgroundColor: C.m100 },
  cardImgEmpty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cardPill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: C.sun,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  cardPillTx: { fontFamily: F.b600, fontSize: 11, color: C.sunInk },
  cardTx: { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 11 },
  cardTitle: { fontFamily: F.h700, fontSize: 15, color: C.forest },
  cardLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardLocTx: { fontFamily: F.b400, fontSize: 12, color: C.muted, flex: 1 },
  cardSal: { fontFamily: F.h700, fontSize: 13, color: C.mint },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.soft,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.mint },
  bulletIn: { flex: 1, fontFamily: F.b500, fontSize: 14, color: C.forest, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    borderRadius: R.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipTx: { fontFamily: F.b500, fontSize: 13, color: C.forest },
  seg: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: R.pill, padding: 4, marginTop: 8 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' },
  segOn: { backgroundColor: C.forest },
  segTx: { fontFamily: F.b600, fontSize: 13, color: C.muted },
  mm: { flexDirection: 'row', gap: 10, marginTop: 16 },
  mmBox: { flex: 1, backgroundColor: C.soft, borderRadius: R.lg, padding: 14 },
  mmNum: { fontFamily: F.h800, fontSize: 22, color: C.forest, marginTop: 2 },
  between: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  rgTrack: { height: 6, borderRadius: 3, backgroundColor: C.line },
  rgFill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: C.mint },
  rgThumb: {
    position: 'absolute',
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.white,
    borderWidth: 3.5,
    borderColor: C.mint,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hero: {
    backgroundColor: C.sun,
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroH: { fontFamily: F.h700, fontSize: 16, color: C.sunInk },
  heroS: { fontFamily: F.b400, fontSize: 12, color: C.sunInk, opacity: 0.8, marginTop: 2 },
  heroOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openIcon: { width: 16, height: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontFamily: F.h800, fontSize: 40, color: C.sunInk, minWidth: 54, textAlign: 'center' },
  tgTrack: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  tgKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white },
  foot: { paddingHorizontal: GUTTER, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.mint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaTx: { fontFamily: F.h700, fontSize: 16, color: C.white },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: GUTTER,
    paddingTop: 10,
  },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 16 },
  sheetH: { fontFamily: F.h800, fontSize: 22, color: C.forest },
  sheetSub: { fontFamily: F.b400, fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 18 },
});