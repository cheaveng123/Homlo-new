/**
 * Homlo — Authentication screen (React Native / Expo)
 * Requires: react-native-svg, react-native-safe-area-context (both ship with Expo)
 *   npx expo install react-native-svg react-native-safe-area-context
 *
 * Auth logic is NOT included — wire the callbacks below to your EXISTING handlers.
 * Illustration elements live in /components/auth-art (or keep them in this file).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ───────────── tokens ───────────── */
const C = {
  green: '#0F6E56',
  deep: '#0A4A3A',
  cream: '#F6F2E9',
  amber: '#F0B04A',
  mist: '#CFE0D8',
  ink: '#17302A',
  muted: '#6B7D76',
  sheet: '#FCFBF7',
  line: '#E4E8E2',
};
// Rounder corners (was 14). Full pill = height / 2.
const FIELD_H = 54;
const RADIUS_FIELD = FIELD_H / 2; // 27
const BUTTON_H = 54;
const RADIUS_BUTTON = BUTTON_H / 2; // 27
const SOCIAL_H = 48;
const RADIUS_SOCIAL = SOCIAL_H / 2; // 24

/* ───────────── illustration elements (each = independent component) ───────────── */
type ArtProps = { size: number };
const box = (size: number, vw: number, vh: number) => ({ width: size, height: (size * vh) / vw });

export const BriefcaseArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 60, 50)} viewBox="0 0 60 50">
    <Path d="M20 12v-3a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v3" fill="none" stroke="#0A4A3A" strokeWidth={4} />
    <Rect x={0} y={12} width={60} height={36} rx={7} fill="#0F6E56" />
    <Path d="M0 28h60" stroke="#0A4A3A" strokeWidth={3} />
    <Rect x={25} y={24} width={10} height={9} rx={2} fill="#F0B04A" />
  </Svg>
);

export const PinArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 80, 100)} viewBox="0 0 80 100">
    <Ellipse cx={40} cy={93} rx={22} ry={5} fill="#CFE0D8" />
    <Path d="M40 4C20 4 5 19 5 38c0 22 28 46 35 55 7-9 35-33 35-55C75 19 60 4 40 4z" fill="#F0B04A" />
    <Circle cx={40} cy={38} r={25} fill="#FBF7EE" />
    <Path d="M26 30h28l3 9H23z" fill="#fff" />
    <Path d="M26 30h7l-2 9h-8zM40 30h7l1 9h-9zM33 30h7v9h-7z" fill="#F0B04A" opacity={0.95} />
    <Rect x={28} y={40} width={24} height={15} fill="#E6D8BC" />
    <Rect x={31} y={43} width={8} height={12} fill="#0F6E56" />
    <Rect x={42} y={43} width={7} height={7} fill="#0A4A3A" />
  </Svg>
);

export const Character1Art = ({ size }: ArtProps) => (
  <Svg {...box(size, 110, 200)} viewBox="0 0 110 200">
    <Ellipse cx={52} cy={190} rx={38} ry={5} fill="#CFE0D8" />
    <Ellipse cx={80} cy={72} rx={14} ry={25} fill="#0A4A3A" />
    <Path d="M42 100l24 0 15 58-13 6z" fill="#E3D2B2" />
    <Path d="M36 100l24 0-8 70-17 2z" fill="#E3D2B2" />
    <Path d="M26 174q10-8 26-4l0 10H26z" fill="#F6F2E9" />
    <Path d="M26 180h26v4H26z" fill="#0F6E56" />
    <Path d="M70 164l16-4 6 6-8 12-16 0z" fill="#F6F2E9" />
    <Path d="M66 176h22v4H66z" fill="#0F6E56" />
    <Path d="M34 46q16-8 34 0l6 56-42 2z" fill="#2F8567" />
    <Path d="M45 48h12l1 54H44z" fill="#FBF7EE" />
    <Path d="M36 52 30 76l14-12" fill="none" stroke="#2F8567" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={45} cy={62} r={5} fill="#F2B58F" />
    <Rect x={42} y={46} width={10} height={17} rx={2} fill="#1C3B33" rotation={12} origin="47, 54" />
    <Rect x={50} y={40} width={9} height={6} fill="#F2B58F" />
    <Circle cx={52} cy={28} r={12.5} fill="#F2B58F" />
    <Path d="M39 28Q38 10 54 12q14 2 12 16-5-8-14-8-8 0-13 8z" fill="#1C3B33" />
    <Path d="M47 33q4 3 8 0" stroke="#A4573A" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </Svg>
);

export const Character2Art = ({ size }: ArtProps) => (
  <Svg {...box(size, 110, 200)} viewBox="0 0 110 200">
    <Ellipse cx={55} cy={190} rx={38} ry={5} fill="#CFE0D8" />
    <Path d="M36 104h38l7 72H59l-4-52-3 52H30z" fill="#1F5C4A" />
    <Ellipse cx={42} cy={178} rx={14} ry={5} fill="#F6F2E9" />
    <Ellipse cx={70} cy={178} rx={14} ry={5} fill="#F6F2E9" />
    <Ellipse cx={55} cy={32} rx={17} ry={19} fill="#2A1F1A" />
    <Path d="M38 52q17-9 34 0l3 54H35z" fill="#E9A93C" />
    <Path d="M38 56 32 92" stroke="#E9A93C" strokeWidth={9} strokeLinecap="round" />
    <Circle cx={32} cy={96} r={5} fill="#D9946E" />
    <Path d="M72 56l14 22" stroke="#E9A93C" strokeWidth={9} strokeLinecap="round" />
    <G rotation={8} origin="82, 88">
      <Rect x={68} y={68} width={30} height={38} rx={5} fill="#FBF7EE" />
      <Rect x={73} y={74} width={14} height={4} rx={2} fill="#0F6E56" />
      <Rect x={73} y={82} width={20} height={3} rx={1.5} fill="#B9D0C6" />
      <Rect x={73} y={88} width={16} height={3} rx={1.5} fill="#B9D0C6" />
      <Circle cx={90} cy={98} r={5} fill="#0F6E56" />
      <Path d="M87.5 98l2 2 3-4" stroke="#fff" strokeWidth={1.5} fill="none" />
    </G>
    <Circle cx={85} cy={82} r={5} fill="#D9946E" />
    <Rect x={50} y={42} width={10} height={8} fill="#D9946E" />
    <Circle cx={55} cy={31} r={11.5} fill="#D9946E" />
    <Path d="M43 30q1-14 13-14 11 0 12 12-9-3-14-10-6 8-11 12z" fill="#2A1F1A" />
    <Path d="M50 36q5 4 10 0" stroke="#8A3F2A" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </Svg>
);

export const JobCardArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 120, 130)} viewBox="0 0 120 130">
    <Rect x={8} y={8} width={108} height={118} rx={12} fill="#B9D0C6" />
    <Rect x={0} y={0} width={108} height={118} rx={12} fill="#FBF7EE" />
    <Circle cx={26} cy={26} r={14} fill="#0F6E56" />
    <Path d="M20 33V20h7v13zm8 0V24h5v9z" fill="#F6F2E9" />
    <Rect x={46} y={16} width={48} height={6} rx={3} fill="#0A4A3A" />
    <Rect x={46} y={28} width={36} height={5} rx={2.5} fill="#B9D0C6" />
    <Circle cx={26} cy={64} r={15} fill="#CFE0D8" />
    <Circle cx={26} cy={60} r={6} fill="#F2B58F" />
    <Path d="M14 76q12-12 24 0z" fill="#2F8567" />
    <Rect x={48} y={52} width={46} height={5} rx={2.5} fill="#B9D0C6" />
    <Rect x={48} y={63} width={32} height={5} rx={2.5} fill="#B9D0C6" />
    <Rect x={10} y={88} width={88} height={20} rx={8} fill="#DCE8E1" />
    <Rect x={18} y={93} width={14} height={11} rx={2} fill="#0F6E56" />
    <Circle cx={62} cy={98} r={5} fill="#F0B04A" />
    <Rect x={72} y={96} width={18} height={4} rx={2} fill="#B9D0C6" />
  </Svg>
);

export const SearchArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 40, 40)} viewBox="0 0 40 40">
    <Circle cx={17} cy={17} r={11} fill="#FBF7EE" stroke="#0F6E56" strokeWidth={5} />
    <Path d="M26 26l11 11" stroke="#F0B04A" strokeWidth={6} strokeLinecap="round" />
  </Svg>
);

export const LaptopArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 90, 62)} viewBox="0 0 90 62">
    <Rect x={12} y={2} width={66} height={44} rx={5} fill="#0A4A3A" />
    <Rect x={16} y={6} width={58} height={36} rx={2} fill="#DCE8E1" />
    <Circle cx={30} cy={20} r={7} fill="#0F6E56" />
    <Rect x={42} y={14} width={26} height={4} rx={2} fill="#B9D0C6" />
    <Rect x={42} y={22} width={18} height={4} rx={2} fill="#B9D0C6" />
    <Path d="M3 48h84l-5 10H8z" fill="#E6D8BC" />
    <Circle cx={76} cy={6} r={9} fill="#F0B04A" />
    <Path d="M72 6l3 3 5-6" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" />
  </Svg>
);

export const CalendarArt = ({ size }: ArtProps) => (
  <Svg {...box(size, 60, 60)} viewBox="0 0 60 60">
    <Rect x={3} y={3} width={54} height={54} rx={8} fill="#E6D8BC" />
    <Rect x={0} y={0} width={54} height={54} rx={8} fill="#FBF7EE" />
    <Path d="M0 14V8a8 8 0 0 1 8-8h38a8 8 0 0 1 8 8v6z" fill="#0F6E56" />
    <Rect x={8} y={22} width={8} height={7} rx={2} fill="#CFE0D8" />
    <Rect x={23} y={22} width={8} height={7} rx={2} fill="#CFE0D8" />
    <Rect x={38} y={22} width={8} height={7} rx={2} fill="#CFE0D8" />
    <Rect x={8} y={35} width={8} height={7} rx={2} fill="#CFE0D8" />
    <Rect x={38} y={35} width={8} height={7} rx={2} fill="#CFE0D8" />
    <Circle cx={27} cy={39} r={6.5} fill="#F0B04A" />
    <Path d="M24 39l2.4 2.4 4-5" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
  </Svg>
);

export const SparkArt = ({ size, flip }: ArtProps & { flip?: boolean }) => (
  <Svg {...box(size, 24, 24)} viewBox="0 0 24 24" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
    <Path d="M4 18 8 14M10 8V3M18 12l4-1" stroke="#F0B04A" strokeWidth={3} strokeLinecap="round" fill="none" />
  </Svg>
);

/* ───────────── animation wrapper (React Native Animated, native driver) ───────────── */
type Mode = 'float' | 'bounce' | 'sway' | 'shine';
type FloatingProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  mode?: Mode;
  amp?: number; // px travel
  duration?: number; // ms for a full cycle
  delay?: number;
  rotate?: number; // base rotation in degrees
  reduceMotion?: boolean;
};

function Floating({ children, style, mode = 'float', amp = 6, duration = 6000, delay = 0, rotate = 0, reduceMotion }: FloatingProps) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const t = (toValue: number, ms: number, easing = Easing.inOut(Easing.ease)) =>
      Animated.timing(v, { toValue, duration: ms, easing, useNativeDriver: true });
    const cycle =
      mode === 'bounce'
        ? Animated.sequence([t(1, 300, Easing.out(Easing.quad)), t(0, 300, Easing.in(Easing.quad)), t(0.35, 150), t(0, 150), Animated.delay(1800)])
        : mode === 'shine'
        ? Animated.sequence([Animated.delay(duration * 0.6), t(1, duration * 0.1), t(0, duration * 0.3)])
        : Animated.sequence([t(1, duration / 2), t(0, duration / 2)]);
    const loop = Animated.loop(cycle);
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [mode, duration, delay, reduceMotion, v]);

  const translateY = mode === 'shine' ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] });
  const deg = mode === 'sway' ? 1.2 : mode === 'float' ? 2 : 0;
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: [`${rotate}deg`, `${rotate + deg}deg`] });
  const opacity = mode === 'shine' ? v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) : 1;

  return (
    <Animated.View pointerEvents="none" style={[styles.abs, style, { opacity, transform: [{ translateY }, { rotate: rot }] }]}>
      {children}
    </Animated.View>
  );
}

/* ───────────── small UI icons ───────────── */
const MailIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={5} width={18} height={14} rx={3} />
    <Path d="m4 8 8 6 8-6" />
  </Svg>
);
const LockIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={5} y={11} width={14} height={9} rx={3} />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
const EyeIcon = ({ off }: { off?: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
    {off && <Path d="M4 4l16 16" />}
  </Svg>
);
const PhoneIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={7} y={2} width={10} height={20} rx={3} />
    <Path d="M11 18h2" />
  </Svg>
);

/* ───────────── screen ───────────── */
type Props = {
  // Wire these to your EXISTING Homlo auth functions — no logic is replaced here.
  onSignIn?: (email: string, password: string) => void;
  onSignUp?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  onSocial?: (provider: 'google' | 'facebook' | 'phone') => void;
  loading?: boolean;
};

export default function AuthScreen({ onSignIn, onSignUp, onForgotPassword, onSocial, loading }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width, 430) / 390; // scale unit (390 = design reference)
  const small = width < 375;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const submit = () => (isSignUp ? onSignUp?.(email, password) : onSignIn?.(email, password));
  const at = (left: number, top: number): ViewStyle => ({ left: left * k, top: top * k });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {/* soft background blobs */}
        <View style={[styles.blob, { width: 260 * k, height: 260 * k, left: -110 * k, top: 90 * k, backgroundColor: '#EDE5D0' }]} />
        <View style={[styles.blob, { width: 200 * k, height: 200 * k, right: -80 * k, top: -40 * k, backgroundColor: '#E3EBDD' }]} />

        {/* ── HERO: every element is an independent animated component ── */}
        <View style={{ height: 342 * k }}>
          <Text style={[styles.logo, { top: Math.max(insets.top + 10, 50 * k) }]}>Homlo</Text>

          {!small && (
            <Floating style={at(26, 116)} rotate={-8} amp={5} duration={7000} reduceMotion={reduceMotion}>
              <BriefcaseArt size={50 * k} />
            </Floating>
          )}
          <Floating style={at(292, 96)} mode="bounce" amp={9} reduceMotion={reduceMotion}>
            <PinArt size={68 * k} />
          </Floating>

          <Floating style={{ ...at(34, 140), zIndex: 2 }} mode="sway" amp={3} duration={5000} reduceMotion={reduceMotion}>
            <Character1Art size={112 * k} />
          </Floating>
          <Floating style={at(small ? 128 : 134, 186)} rotate={-7} amp={6} duration={6000} delay={800} reduceMotion={reduceMotion}>
            <JobCardArt size={(small ? 80 : 96) * k} />
          </Floating>
          <Floating style={at(236, 148)} amp={6} duration={4500} delay={400} reduceMotion={reduceMotion}>
            <SearchArt size={34 * k} />
          </Floating>
          <Floating style={{ ...at(262, 150), zIndex: 2 }} mode="sway" amp={3} duration={5500} delay={1200} reduceMotion={reduceMotion}>
            <Character2Art size={108 * k} />
          </Floating>
          <Floating style={at(208, 276)} rotate={4} amp={5} duration={6000} delay={1500} reduceMotion={reduceMotion}>
            <LaptopArt size={70 * k} />
          </Floating>

          <Floating style={at(92, 96)} mode="shine" duration={4000} reduceMotion={reduceMotion}>
            <SparkArt size={22 * k} />
          </Floating>
          {!small && (
            <Floating style={at(180, 126)} mode="shine" duration={4000} delay={2000} reduceMotion={reduceMotion}>
              <SparkArt size={22 * k} flip />
            </Floating>
          )}
        </View>

        {/* ── AUTH SHEET ── */}
        <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
          <Text style={styles.title}>{isSignUp ? 'Create your account' : 'Sign in to your account'}</Text>
          <Text style={styles.sub}>{isSignUp ? 'Join Homlo in a minute.' : 'Find work or hire people near you.'}</Text>

          <View style={[styles.field, focus === 'email' && styles.fieldFocus]}>
            <MailIcon />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9AA8A2"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
            />
          </View>
          <View style={[styles.field, focus === 'password' && styles.fieldFocus]}>
            <LockIcon />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9AA8A2"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              textContentType={isSignUp ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
            />
            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
              <EyeIcon off={!showPw} />
            </Pressable>
          </View>

          {!isSignUp && (
            <Pressable onPress={onForgotPassword} style={styles.forgot} hitSlop={8}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{isSignUp ? 'Sign up' : 'Sign in'}</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{isSignUp ? 'Or sign up with' : 'Or sign in with'}</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.socials}>
            <Pressable style={styles.social} onPress={() => onSocial?.('google')} accessibilityLabel="Continue with Google">
              <Text style={[styles.socialText, { color: '#DB4437' }]}>G</Text>
            </Pressable>
            <Pressable style={styles.social} onPress={() => onSocial?.('facebook')} accessibilityLabel="Continue with Facebook">
              <Text style={[styles.socialText, { color: '#1877F2' }]}>f</Text>
            </Pressable>
            <Pressable style={styles.social} onPress={() => onSocial?.('phone')} accessibilityLabel="Continue with phone number">
              <PhoneIcon />
            </Pressable>
          </View>

          <View style={styles.altRow}>
            <Text style={styles.altText}>{isSignUp ? 'Already have an account? ' : 'Don’t have an account? '}</Text>
            <Pressable onPress={() => setIsSignUp((s) => !s)} hitSlop={8}>
              <Text style={styles.link}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
            </Pressable>
          </View>

          {/* lower framing elements (don't intercept touches) */}
          <Floating style={{ left: 14 * k, bottom: 16 * k + insets.bottom }} rotate={-8} amp={5} duration={7000} delay={500} reduceMotion={reduceMotion}>
            <CalendarArt size={50 * k} />
          </Floating>
          {!small && (
            <Floating style={{ right: 24 * k, bottom: 30 * k + insets.bottom }} mode="shine" duration={4000} delay={1000} reduceMotion={reduceMotion}>
              <SparkArt size={20 * k} />
            </Floating>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ───────────── styles ───────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  scroll: { flexGrow: 1, backgroundColor: C.cream },
  abs: {
    position: 'absolute',
    ...Platform.select({
      ios: { shadowColor: '#0F4637', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
      default: {},
    }),
  },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.7 },
  logo: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: C.deep,
    zIndex: 3,
  },
  sheet: {
    flex: 1,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 26,
    zIndex: 3,
    ...Platform.select({
      ios: { shadowColor: C.ink, shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
      android: { elevation: 8 },
    }),
  },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, color: C.ink, textAlign: 'center' },
  sub: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_H,
    borderRadius: RADIUS_FIELD,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 10,
  },
  fieldFocus: { borderColor: C.green },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: C.ink, paddingVertical: 0 },
  forgot: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14, paddingRight: 8 },
  link: { color: C.green, fontWeight: '600', fontSize: 13.5 },
  cta: {
    height: BUTTON_H,
    borderRadius: RADIUS_BUTTON,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 4 },
    }),
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: C.line },
  orText: { color: C.muted, fontSize: 13 },
  socials: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  social: {
    width: 64,
    height: SOCIAL_H,
    borderRadius: RADIUS_SOCIAL,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: { fontSize: 19, fontWeight: '700' },
  altRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  altText: { fontSize: 14, color: C.muted },
});
