/**
 * Explore tab icons in a soft, rendered three-quarter style: real materials, gentle
 * lighting from the top-left, a contact shadow, and small physical details.
 *   Jobs      → leather briefcase with brass clasps and stitching
 *   Job map   → folded paper map with a glossy red pin
 *   Employers → office tower with a glass curtain wall and a person waving
 * Selecting a tab gives its icon one soft lift; nothing loops.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SMOOTH } from '@/src/design/motion';

const SIZE = 58;

/** A soft drop shadow under the drawing itself (iOS follows the icon's shape). */
const depth = { shadowColor: '#0B1B26', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 5 } } as const;

/** One soft lift when the tab becomes active. */
function Lift({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) return;
    y.value = withSequence(withTiming(-4, { duration: 180, easing: SMOOTH }), withTiming(0, { duration: 360, easing: SMOOTH }));
  }, [active, reduced, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: SIZE, height: SIZE }, depth, a]}>{children}</Animated.View>;
}

/* ───────── briefcase ───────── */

function Briefcase() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="bShadow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#0B1B26" stopOpacity={0.3} /><Stop offset="1" stopColor="#0B1B26" stopOpacity={0} /></RadialGradient>
        <LinearGradient id="bFront" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#D99555" /><Stop offset="0.5" stopColor="#B06A33" /><Stop offset="1" stopColor="#7A421D" /></LinearGradient>
        <LinearGradient id="bSide" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#83461F" /><Stop offset="1" stopColor="#5A2C10" /></LinearGradient>
        <LinearGradient id="bTop" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#EDB57C" /><Stop offset="1" stopColor="#CE8B4E" /></LinearGradient>
        <LinearGradient id="bFlap" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#C77E43" /><Stop offset="1" stopColor="#A5612F" /></LinearGradient>
        <LinearGradient id="bHandle" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#6B3A18" /><Stop offset="1" stopColor="#3A1C08" /></LinearGradient>
        <LinearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFF1BF" /><Stop offset="0.45" stopColor="#E7B347" /><Stop offset="1" stopColor="#9A6A16" /></LinearGradient>
        <RadialGradient id="bGloss" cx="25%" cy="15%" r="70%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></RadialGradient>
        <LinearGradient id="bAO" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.7" stopColor="#2A1305" stopOpacity={0} /><Stop offset="1" stopColor="#2A1305" stopOpacity={0.35} /></LinearGradient>
      </Defs>
      <Ellipse cx={31} cy={56.2} rx={25} ry={4.4} fill="url(#bShadow)" />
      {/* handle + rings */}
      <Path d="M22.5 22v-5.4a4.4 4.4 0 0 1 4.4-4.4h8.2a4.4 4.4 0 0 1 4.4 4.4V22" fill="none" stroke="url(#bHandle)" strokeWidth={4.2} strokeLinecap="round" />
      <Path d="M24.1 20v-3.4a3 3 0 0 1 3-3h6.6" fill="none" stroke="#B87A45" strokeWidth={1.1} strokeLinecap="round" opacity={0.85} />
      <Rect x={20.4} y={20.6} width={4.2} height={3.4} rx={1.2} fill="url(#brass)" />
      <Rect x={37.4} y={20.6} width={4.2} height={3.4} rx={1.2} fill="url(#brass)" />
      {/* top + side */}
      <Path d="M7.5 25.5 14 21h42l-6.5 4.5Z" fill="url(#bTop)" />
      <Path d="M49.5 25.5 56 21v27a3.2 3.2 0 0 1-1.4 2.6L49.5 54Z" fill="url(#bSide)" />
      <Path d="M49.5 36.6 56 32.1" stroke="#3E1C07" strokeWidth={1} opacity={0.6} />
      {/* front, flap, seam */}
      <Rect x={7.5} y={25.5} width={42} height={28.5} rx={5.5} fill="url(#bFront)" />
      <Path d="M7.5 25.5h42v10.6a2.2 2.2 0 0 1-2.2 2.2H9.7a2.2 2.2 0 0 1-2.2-2.2Z" fill="url(#bFlap)" />
      <Path d="M8.2 38.3h40.6" stroke="#4E250C" strokeWidth={1.2} opacity={0.75} />
      <Path d="M8.2 39.6h40.6" stroke="#EDB57C" strokeWidth={0.8} opacity={0.6} />
      <Rect x={7.5} y={25.5} width={42} height={28.5} rx={5.5} fill="url(#bAO)" />
      {/* stitching */}
      <Path d="M10.3 30.2v-1.4a1.5 1.5 0 0 1 1.5-1.5h33.4a1.5 1.5 0 0 1 1.5 1.5v6" fill="none" stroke="#F7D3A3" strokeWidth={0.7} strokeDasharray="1.4 1.2" opacity={0.8} />
      <Rect x={10.3} y={41.6} width={36.4} height={10} rx={2.6} fill="none" stroke="#F7D3A3" strokeWidth={0.7} strokeDasharray="1.4 1.2" opacity={0.55} />
      <Rect x={7.5} y={25.5} width={42} height={28.5} rx={5.5} fill="url(#bGloss)" />
      {/* clasps */}
      <G>
        <Rect x={13.4} y={35.1} width={7.6} height={6.6} rx={1.8} fill="url(#brass)" stroke="#7A520F" strokeWidth={0.5} />
        <Rect x={15.8} y={38.4} width={2.8} height={1.6} rx={0.7} fill="#5C3D0B" />
        <Path d="M14.4 36h5.6" stroke="#FFF7D6" strokeWidth={0.7} strokeLinecap="round" opacity={0.9} />
      </G>
      <G>
        <Rect x={36} y={35.1} width={7.6} height={6.6} rx={1.8} fill="url(#brass)" stroke="#7A520F" strokeWidth={0.5} />
        <Rect x={38.4} y={38.4} width={2.8} height={1.6} rx={0.7} fill="#5C3D0B" />
        <Path d="M37 36h5.6" stroke="#FFF7D6" strokeWidth={0.7} strokeLinecap="round" opacity={0.9} />
      </G>
      <Path d="M12 25.9h33" stroke="#FFD7A8" strokeWidth={0.9} strokeLinecap="round" />
      <Rect x={11.5} y={53.4} width={5.5} height={1.9} rx={0.9} fill="#2E1606" />
      <Rect x={40} y={53.4} width={5.5} height={1.9} rx={0.9} fill="#2E1606" />
    </Svg>
  );
}

/* ───────── folded map with pin ───────── */

function FoldedMap() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="mShadow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#0B1B26" stopOpacity={0.28} /><Stop offset="1" stopColor="#0B1B26" stopOpacity={0} /></RadialGradient>
        <LinearGradient id="p1" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FBF8EE" /><Stop offset="1" stopColor="#E9E2CC" /></LinearGradient>
        <LinearGradient id="p2" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#CFC6AB" /><Stop offset="1" stopColor="#E4DCC4" /></LinearGradient>
        <LinearGradient id="p3" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFFDF6" /><Stop offset="1" stopColor="#EDE6D2" /></LinearGradient>
        <RadialGradient id="pinHead" cx="34%" cy="28%" r="78%"><Stop offset="0" stopColor="#FFC1A8" /><Stop offset="0.3" stopColor="#F7684A" /><Stop offset="0.8" stopColor="#C9321F" /><Stop offset="1" stopColor="#951C10" /></RadialGradient>
        <LinearGradient id="pinTip" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#E04A2F" /><Stop offset="0.5" stopColor="#B92B19" /><Stop offset="1" stopColor="#7F180C" /></LinearGradient>
        <RadialGradient id="pinShadow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#3A2A10" stopOpacity={0.5} /><Stop offset="1" stopColor="#3A2A10" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="pinDot" cx="40%" cy="35%" r="70%"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#F1E2DC" /></RadialGradient>
        <ClipPath id="c1"><Path d="M6 28 22 22.5v29L6 57Z" /></ClipPath>
        <ClipPath id="c2"><Path d="M22 22.5 40 28v29l-18-5.5Z" /></ClipPath>
        <ClipPath id="c3"><Path d="M40 28 58 22.5v29L40 57Z" /></ClipPath>
      </Defs>
      <Ellipse cx={32} cy={58.4} rx={27} ry={4} fill="url(#mShadow)" />
      {/* paper thickness */}
      <Path d="M6 57 22 51.5 40 57 58 51.5v1.4L40 58.4 22 52.9 6 58.4Z" fill="#B7AD8D" />
      {/* panels */}
      <Path d="M6 28 22 22.5v29L6 57Z" fill="url(#p1)" />
      <Path d="M22 22.5 40 28v29l-18-5.5Z" fill="url(#p2)" />
      <Path d="M40 28 58 22.5v29L40 57Z" fill="url(#p3)" />
      <G clipPath="url(#c1)">
        <Path d="M3 46c5-2 9 1 13-2s6-6 8-6" stroke="#6FBDE0" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        <Path d="M3 46c5-2 9 1 13-2s6-6 8-6" stroke="#B9E2F2" strokeWidth={1} fill="none" strokeLinecap="round" />
        <Ellipse cx={13} cy={32} rx={4.6} ry={3.1} fill="#A6D08A" />
        <Path d="M6 38.5l17-4.5M15 24v32" stroke="#FFFFFF" strokeWidth={1.7} />
      </G>
      <G clipPath="url(#c2)">
        <Path d="M20 39c4 0 6 3 10 2s6-4 12-3" stroke="#5FA9CB" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        <Path d="M22 46l18 4" stroke="#EAE3CC" strokeWidth={1.7} />
        <Ellipse cx={33} cy={51} rx={4.2} ry={2.6} fill="#8DB972" />
      </G>
      <G clipPath="url(#c3)">
        <Path d="M38 38.5c5-1 8-4 12-4s7 1 10 0" stroke="#6FBDE0" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        <Path d="M38 38.5c5-1 8-4 12-4s7 1 10 0" stroke="#B9E2F2" strokeWidth={1} fill="none" strokeLinecap="round" />
        <Ellipse cx={51} cy={46.5} rx={5} ry={3.2} fill="#A6D08A" />
        <Path d="M40 32.5l18-5M47 25v32" stroke="#FFFFFF" strokeWidth={1.7} />
      </G>
      {/* folds */}
      <Path d="M22 22.5v29M40 28v29" stroke="#A89E80" strokeWidth={0.9} />
      <Path d="M6 28 22 22.5 40 28 58 22.5" fill="none" stroke="#FFFFFF" strokeWidth={1} />
      {/* pin */}
      <Ellipse cx={32} cy={42.2} rx={5} ry={1.8} fill="url(#pinShadow)" />
      <Path d="M27.4 22.6 32 42l4.6-19.4Z" fill="url(#pinTip)" />
      <Circle cx={32} cy={18} r={9} fill="url(#pinHead)" />
      <Circle cx={32} cy={18} r={3.6} fill="url(#pinDot)" />
      <Path d="M29 18.8a3.2 3.2 0 0 0 6 0" fill="none" stroke="#D6B8AC" strokeWidth={0.6} opacity={0.7} />
      <Ellipse cx={28.8} cy={13.4} rx={2.7} ry={1.5} fill="#FFFFFF" opacity={0.6} rotation={-32} originX={28.8} originY={13.4} />
    </Svg>
  );
}

/* ───────── office tower ───────── */

const WINDOWS = (() => {
  const out: { d: string; hl: string; lit: boolean }[] = [];
  const cols = [19, 24.2, 29.4];
  [0, 1, 2, 3].forEach((r) => cols.forEach((x, ci) => {
    if (r === 3 && ci < 2) return; // room for the entrance
    const y = 21.4 + ((x - 16) * 6.5) / 18 + r * 6.4;
    out.push({
      d: `M${x} ${y} ${x + 3.2} ${y + 1.16}v3.8l-3.2-1.16Z`,
      hl: `M${x + 0.4} ${y + 0.6} ${x + 1.6} ${y + 1.04}`,
      lit: (r === 1 && ci === 2) || (r === 2 && ci === 0) || (r === 0 && ci === 1),
    });
  }));
  return out;
})();

function OfficeTower() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="oShadow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#0B1B26" stopOpacity={0.3} /><Stop offset="1" stopColor="#0B1B26" stopOpacity={0} /></RadialGradient>
        <LinearGradient id="oLeft" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FAFCFD" /><Stop offset="1" stopColor="#D3DCE2" /></LinearGradient>
        <LinearGradient id="oRight" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#5BA9D6" /><Stop offset="0.55" stopColor="#2E79AC" /><Stop offset="1" stopColor="#1A4C74" /></LinearGradient>
        <LinearGradient id="oTop" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#E1E8ED" /></LinearGradient>
        <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#B6E0F3" /><Stop offset="1" stopColor="#3F87B7" /></LinearGradient>
        <LinearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE29A" /><Stop offset="1" stopColor="#F0A52C" /></LinearGradient>
        <LinearGradient id="refl" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} /><Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.5} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></LinearGradient>
        <RadialGradient id="skin" cx="38%" cy="32%" r="72%"><Stop offset="0" stopColor="#FFDDBF" /><Stop offset="1" stopColor="#E3A479" /></RadialGradient>
        <LinearGradient id="jacket" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2F5B80" /><Stop offset="1" stopColor="#14324A" /></LinearGradient>
        <LinearGradient id="pants" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#3B4A58" /><Stop offset="1" stopColor="#222D38" /></LinearGradient>
        <ClipPath id="rf"><Path d="M34 24 52 17.5v33L34 57Z" /></ClipPath>
      </Defs>
      <Ellipse cx={34} cy={57.6} rx={25} ry={4.2} fill="url(#oShadow)" />
      {/* roof unit */}
      <Path d="M28 15.4 33.5 13.4l5.5 2-5.5 2Z" fill="#D4DDE3" />
      <Path d="M28 15.4v2.6l5.5 2v-2.6Z" fill="#B3C0C8" />
      <Path d="M33.5 17.4V20l5.5-2v-2.6Z" fill="#92A1AA" />
      {/* roof + parapet */}
      <Path d="M16 17.5 34 11l18 6.5-18 6.5Z" fill="url(#oTop)" />
      <Path d="M16 17.5 34 24 52 17.5v1.2L34 25.2 16 18.7Z" fill="#C3CFD7" />
      {/* faces */}
      <Path d="M16 18.7 34 25.2V57L16 50.5Z" fill="url(#oLeft)" />
      <Path d="M34 25.2 52 18.7v31.8L34 57Z" fill="url(#oRight)" />
      <G clipPath="url(#rf)">
        <Path d="M34 31.6 52 25.1M34 38 52 31.5M34 44.4 52 37.9M34 50.8 52 44.3M40 23v34M46 21v34" stroke="#143A58" strokeWidth={0.7} opacity={0.55} />
        <Path d="M37 60 52 25v8L42 60Z" fill="url(#refl)" />
      </G>
      {/* windows */}
      {WINDOWS.map((w, i) => (
        <G key={i}>
          <Path d={w.d} fill={w.lit ? 'url(#lit)' : 'url(#glass)'} />
          <Path d={w.hl} stroke="#FFFFFF" strokeWidth={0.5} opacity={0.7} />
        </G>
      ))}
      {/* canopy + entrance */}
      <Path d="M20.4 45.6 28.6 48.6v1.6l-8.2-3Z" fill="#14324A" />
      <Path d="M21.2 47.6 27.8 50v5.6l-6.6-2.4Z" fill="#1E4A6B" />
      <Path d="M22 48.4l2.4.9v4.9l-2.4-.9Z" fill="#7CC1E4" opacity={0.85} />
      <Path d="M34 25.2V57" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.85} />
      {/* a person standing beside the building, facing out and waving */}
      <G scale={1.32} origin="9.4, 56">
      <Ellipse cx={9.4} cy={56} rx={5.6} ry={1.2} fill="#0B1B26" opacity={0.22} />
      {/* legs + shoes */}
      <Rect x={6.7} y={46} width={2.5} height={9.2} rx={1.1} fill="url(#pants)" />
      <Rect x={9.6} y={46} width={2.5} height={9.2} rx={1.1} fill="url(#pants)" />
      <Ellipse cx={7.7} cy={55.2} rx={1.9} ry={0.85} fill="#0E1C28" />
      <Ellipse cx={11.1} cy={55.2} rx={1.9} ry={0.85} fill="#0E1C28" />
      {/* lowered arm (behind the jacket edge) */}
      <Path d="M5.6 39.6 4.4 46.2" stroke="url(#jacket)" strokeWidth={2.3} strokeLinecap="round" />
      <Circle cx={4.3} cy={46.9} r={1.15} fill="url(#skin)" />
      {/* waving arm */}
      <Path d="M13.2 39.4 15.6 34.4" stroke="url(#jacket)" strokeWidth={2.3} strokeLinecap="round" />
      <Circle cx={15.9} cy={33.4} r={1.25} fill="url(#skin)" />
      {/* jacket, shirt, badge */}
      <Path d="M4.9 40.6a3.8 3.8 0 0 1 3.8-3.8h1.4a3.8 3.8 0 0 1 3.8 3.8v6.6H4.9Z" fill="url(#jacket)" />
      <Path d="M8 36.8h2.8l-1.4 4.4Z" fill="#FFFFFF" />
      <Path d="M9.4 41.2V47" stroke="#0B2236" strokeWidth={0.5} opacity={0.6} />
      <Rect x={10.4} y={41.6} width={2} height={2.5} rx={0.4} fill="#FFFFFF" />
      <Rect x={10.4} y={41.6} width={2} height={0.8} rx={0.3} fill="#F5A524" />
      <Path d="M5.6 38.4c.6-.9 1.6-1.4 2.6-1.5" stroke="#5C7C98" strokeWidth={0.6} fill="none" strokeLinecap="round" />
      {/* head */}
      <Rect x={8.6} y={34.4} width={1.6} height={2.6} rx={0.6} fill="#D99B72" />
      <Circle cx={9.4} cy={31.6} r={3.7} fill="url(#skin)" />
      <Path d="M5.7 31.2a3.7 3.7 0 0 1 7.4 0c-1.5-.8-2.9-1.2-4.2-1-1.1.2-2.1.5-3.2 1Z" fill="#2A1A10" />
      <Circle cx={8.2} cy={32.1} r={0.42} fill="#2A1A10" />
      <Circle cx={10.6} cy={32.1} r={0.42} fill="#2A1A10" />
      <Path d="M8.4 33.6q1 .8 2 0" stroke="#8A4B2A" strokeWidth={0.5} fill="none" strokeLinecap="round" />
      <Ellipse cx={7.9} cy={30.4} rx={1} ry={0.6} fill="#FFFFFF" opacity={0.35} />
      </G>
    </Svg>
  );
}

export function JobsTabIcon({ active }: { active: boolean }) {
  return <Lift active={active}><Briefcase /></Lift>;
}
export function MapTabIcon({ active }: { active: boolean }) {
  return <Lift active={active}><FoldedMap /></Lift>;
}
export function EmployersTabIcon({ active }: { active: boolean }) {
  return <Lift active={active}><OfficeTower /></Lift>;
}

/** Static preview at any size (e.g. docs or a settings screen). */
export function TabIconPreview({ name }: { name: 'jobs' | 'map' | 'employers' }) {
  return <View>{name === 'jobs' ? <Briefcase /> : name === 'map' ? <FoldedMap /> : <OfficeTower />}</View>;
}
