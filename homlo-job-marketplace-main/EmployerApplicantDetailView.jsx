// EmployerApplicantDetailView.jsx
// Employer side > Post a job > New applicants tab > tap an applicant card > this page.
// Bare React Native. No Expo packages. Needs: react-native-svg, react-native-safe-area-context.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, Pressable, ScrollView, StyleSheet, Platform, AccessibilityInfo,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ---------- Tokens ---------- */
const C = {
  teal: '#0E7C86', deep: '#073B42', tint: '#D8F0EE', bg: '#FFFFFF', text: '#14272B',
  muted: '#58696B', line: '#E4ECEC', holder: '#EAEFEF', holderIcon: '#8A9A9C',
  clay: '#C4531F', cream: '#FFF1D2', creamInk: '#7A4300', danger: '#C0392B', dangerBg: '#FBEAE6',
};
// Change these to your real font names.
const F = { head: 'PlusJakartaSans_800ExtraBold', headB: 'PlusJakartaSans_700Bold', ui: 'Inter_400Regular', uiM: 'Inter_500Medium', uiB: 'Inter_600SemiBold' };

/* ---------- Custom line icons (24 grid, 1.6 stroke, round caps) ---------- */
function Icon({ name, size = 20, color = C.teal, sw = 1.6 }) {
  const p = { stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  const g = {
    back: <Path d="M19 12H5M11 6l-6 6 6 6" {...p} />,
    user: (<><Circle cx="12" cy="8.5" r="3.5" {...p} /><Path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...p} /></>),
    job: (<><Rect x="3" y="8" width="18" height="12" rx="3" {...p} /><Path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3 13h18M11 12.5V15h2v-2.5" {...p} /></>),
    pin: (<><Path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z" {...p} /><Circle cx="12" cy="10" r="2.3" {...p} /></>),
    coin: (<><Circle cx="12" cy="12" r="8.5" {...p} /><Path d="M14.6 9.4C14.1 8.6 13.2 8.1 12 8.1c-1.3 0-2.3.7-2.3 1.7 0 2.5 4.6 1.2 4.6 3.7 0 1-1 1.7-2.3 1.7-1.1 0-2-.5-2.6-1.3M12 6.6v1.5M12 15.6v1.6" {...p} /></>),
    cal: (<><Rect x="4" y="5" width="16" height="15" rx="3.5" {...p} /><Path d="M4 10h16M8 3v4M16 3v4" {...p} /><Circle cx="12" cy="15" r="1.2" {...p} /></>),
    badge: (<><Path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.3l7-2.8z" {...p} /><Path d="M8.8 12.2l2.2 2.2 4.2-4.4" {...p} /></>),
    check: <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />,
    doc: (<><Path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" {...p} /><Path d="M14 3v4h4M9 12h6M9 16h4" {...p} /></>),
    chat: (<><Path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16H10l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" {...p} /><Path d="M8 9.5h8M8 12.5h5" {...p} /></>),
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{g[name]}</Svg>;
}

/* ---------- Motion helpers (core Animated, respects Reduce Motion) ---------- */
function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setR).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => sub && sub.remove && sub.remove();
  }, []);
  return r;
}

function Rise({ index = 0, reduce, style, children }) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 420, delay: index * 70, useNativeDriver: true }).start();
  }, [reduce]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function Press({ onPress, style, children, label, reduce }) {
  const k = useRef(new Animated.Value(1)).current;
  const to = (x) => !reduce && Animated.timing(k, { toValue: x, duration: 90, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale: k }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
        onPressIn={() => to(0.975)} onPressOut={() => to(1)} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- Small parts ---------- */
const Holder = ({ size }) => (
  <View style={[s.holder, { width: size, height: size, borderRadius: size / 2 }]}>
    <Icon name="user" size={size / 2} color={C.holderIcon} sw={1.5} />
  </View>
);

const Box = ({ icon, title, children }) => (
  <View style={s.box}>
    <View style={s.bh}>
      <View style={s.tile}><Icon name={icon} /></View>
      <Text style={s.bhTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({ icon, label, children, first }) => (
  <View style={[s.row, !first && s.rowLine]}>
    <View style={s.rowIcon}><Icon name={icon} /></View>
    {label ? <Text style={s.rowLabel}>{label}</Text> : null}
    <View style={label ? s.rowEndRight : s.rowEndLeft}>{children}</View>
  </View>
);

/* ---------- Screen ---------- */
// Bind these props to your existing applicant + job data. Do not keep the defaults.
export default function EmployerApplicantDetailView({
  applicant = { name: 'Worker', tagline: 'The best in the world', status: 'Hired', appliedAgo: '6d ago', coverMessage: 'Worker\n\nYes' },
  job = { title: 'Coffee Barista (Part-time)', place: 'Boeung Keng Kang, Phnom Penh', pay: 'USD 2.5 / hour' },
  labels = {
    title: 'Applicant', applyingFor: 'Applying for', yourListing: 'Your job listing', application: 'Application',
    applied: 'Applied', status: 'Status', resume: 'Resume', noResume: 'No resume attached',
    resumeNote: 'Resume upload will be available when secure media storage is added.',
    cover: 'Cover message', message: 'Message applicant',
  },
  onBack, onMessage,
  topInset, bottomInset, // pass 0 if a navigation header / tab bar already handles the safe area
}) {
  const insets = useSafeAreaInsets();
  const top = topInset !== undefined ? topInset : insets.top;
  const bottom = bottomInset !== undefined ? bottomInset : insets.bottom;
  const reduce = useReduceMotion();
  const y = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true });
  const barTitle = y.interpolate({ inputRange: [60, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const barLine = y.interpolate({ inputRange: [0, 12], outputRange: [0, 1], extrapolate: 'clamp' });

  const bad = applicant.status === 'Rejected';
  const pillBg = bad ? C.dangerBg : C.tint;
  const pillFg = bad ? C.danger : C.deep;

  return (
    <View style={s.screen}>
      {/* Header, back button sits lower */}
      <View style={[s.top, { paddingTop: top + 16 }]}>
        <Press onPress={onBack} label="Back" reduce={reduce} style={s.back}>
          <Icon name="back" size={24} color={C.deep} sw={1.8} />
        </Press>
        <Animated.Text style={[s.topTitle, { opacity: barTitle }]} numberOfLines={1}>{labels.title}</Animated.Text>
        <Animated.View pointerEvents="none" style={[s.topLine, { opacity: barLine }]} />
      </View>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} decelerationRate="normal"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 112 + bottom }]}>

        <Rise index={0} reduce={reduce} style={s.identity}>
          <Holder size={72} />
          <Text style={s.name}>{applicant.name}</Text>
          {applicant.tagline ? <Text style={s.tagline}>{applicant.tagline}</Text> : null}
        </Rise>

        <Rise index={1} reduce={reduce} style={s.sec}>
          <Box icon="job" title={labels.applyingFor}>
            <View style={s.bb}>
              <Text style={s.jobTitle}>{job.title}</Text>
              <View style={s.chip}><Text style={s.chipText}>{labels.yourListing}</Text></View>
            </View>
            <View style={s.rows}>
              <Row icon="pin" first><Text style={s.place}>{job.place}</Text></Row>
              <Row icon="coin"><Text style={s.pay}>{job.pay}</Text></Row>
            </View>
          </Box>
        </Rise>

        <Rise index={2} reduce={reduce} style={s.sec}>
          <Box icon="badge" title={labels.application}>
            <View style={s.rows}>
              <Row icon="cal" label={labels.applied} first><Text style={s.value}>{applicant.appliedAgo}</Text></Row>
              <Row icon="badge" label={labels.status}>
                <View style={[s.pill, { backgroundColor: pillBg }]}>
                  <Icon name="check" size={16} color={bad ? C.danger : C.teal} sw={2} />
                  <Text style={[s.pillText, { color: pillFg }]}>{applicant.status}</Text>
                </View>
              </Row>
            </View>
          </Box>
        </Rise>

        <Rise index={3} reduce={reduce} style={s.sec}>
          <Box icon="doc" title={labels.resume}>
            <View style={s.bb}>
              <Text style={s.value}>{labels.noResume}</Text>
              <Text style={s.small}>{labels.resumeNote}</Text>
            </View>
          </Box>
        </Rise>

        <Rise index={4} reduce={reduce} style={s.sec}>
          <Box icon="chat" title={labels.cover}>
            <View style={[s.bb, s.comment]}>
              <View style={{ marginRight: 12 }}><Holder size={36} /></View>
              <View style={{ flex: 1 }}>
                <View style={s.chead}>
                  <Text style={s.cname}>{applicant.name}</Text>
                  <Text style={s.small}>{applicant.appliedAgo}</Text>
                </View>
                <View style={s.bubble}><Text style={s.body}>{applicant.coverMessage}</Text></View>
              </View>
            </View>
          </Box>
        </Rise>
      </Animated.ScrollView>

      <View style={[s.bar, { paddingBottom: 16 + bottom }]}>
        <Press onPress={onMessage} label={labels.message} reduce={reduce} style={s.cta}>
          <Text style={s.ctaText}>{labels.message}</Text>
        </Press>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { paddingBottom: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontFamily: F.headB, fontSize: 17, color: C.deep, marginLeft: 4 },
  topLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: C.line },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  sec: { marginBottom: 16 },

  identity: { paddingHorizontal: 4, marginBottom: 24 },
  holder: { backgroundColor: C.holder, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.head, fontSize: 24, lineHeight: 32, color: C.deep, marginTop: 16 },
  tagline: { fontFamily: F.ui, fontSize: 16, lineHeight: 24, color: C.muted },

  box: { backgroundColor: C.bg, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  bh: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  tile: { marginRight: 12, width: 32, height: 32, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  bhTitle: { fontFamily: F.headB, fontSize: 16, color: C.deep },
  bb: { padding: 16 },
  rows: { paddingHorizontal: 16 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  rowIcon: { width: 32, alignItems: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.muted },
  rowEndRight: { alignItems: 'flex-end' },
  rowEndLeft: { flex: 1, alignItems: 'flex-start' },

  jobTitle: { fontFamily: F.head, fontSize: 20, lineHeight: 28, color: C.deep },
  chip: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.cream },
  chipText: { fontFamily: F.uiB, fontSize: 12, lineHeight: 20, color: C.creamInk },
  place: { fontFamily: F.uiM, fontSize: 14, color: C.text },
  pay: { fontFamily: F.headB, fontSize: 16, color: C.clay },
  value: { fontFamily: F.uiB, fontSize: 16, lineHeight: 24, color: C.text },
  small: { fontFamily: F.ui, fontSize: 13, lineHeight: 20, color: C.muted },
  body: { fontFamily: F.ui, fontSize: 16, lineHeight: 24, color: C.text },

  pill: { flexDirection: 'row', alignItems: 'center', height: 28, paddingLeft: 8, paddingRight: 12, borderRadius: 999 },
  pillText: { fontFamily: F.uiB, fontSize: 13, marginLeft: 4 },

  comment: { flexDirection: 'row', alignItems: 'flex-start' },
  chead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  cname: { fontFamily: F.uiB, fontSize: 14, color: C.text, marginRight: 8 },
  bubble: { borderWidth: 1, borderColor: C.line, borderRadius: 18, borderTopLeftRadius: 4, paddingVertical: 12, paddingHorizontal: 16 },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  cta: { height: 48, borderRadius: 999, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: F.headB, fontSize: 16, color: '#fff' },
});
