// vistaScenes.tsx
// 19 animated hero illustrations, one per category (index matches VISTA_CATEGORIES).
// Each scene is drawn in a 160×120 box. Every piece of artwork moves.
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { VistaDraw as D, VistaMove as M } from './vistaMotion';

type P = { i: string; a: string; l: string }; // ink, accent, light
const W = '#fff';

const SCENES: ((c: P) => React.ReactElement)[] = [
  // 0 Sales & Business — bars grow, arrow draws upward
  (c) => (<>
    <Path d="M18 102h124" />
    <M kind="grow" origin={[37, 102]}><Rect x={28} y={72} width={18} height={30} fill={c.l} /></M>
    <M kind="grow" delay={0.3} origin={[67, 102]}><Rect x={58} y={56} width={18} height={46} fill={c.l} /></M>
    <M kind="grow" delay={0.6} origin={[97, 102]}><Rect x={88} y={38} width={18} height={64} fill={c.a} /></M>
    <D d="M24 58l34-20 26 8 42-30m-12 0h12v12" stroke={c.a} />
  </>),

  // 1 Marketing & Media — shaking megaphone + sound waves
  (c) => (<>
    <M kind="sw" duration={1.6} origin={[52, 60]}>
      <Path d="M34 58l54-26v56z" fill={c.a} />
      <Rect x={18} y={50} width={20} height={16} rx={4} fill={c.l} />
    </M>
    <Path d="M42 84l6 22h10l-5-20" />
    <M kind="bl"><Path d="M100 46q10 14 0 28" /></M>
    <M kind="bl" delay={0.3}><Path d="M112 36q18 24 0 48" /></M>
    <M kind="bl" delay={0.6}><Path d="M124 26q26 34 0 68" /></M>
  </>),

  // 2 Finance & Accounting — clean bar chart, gridlines, trend line with markers
  (c) => (<>
    <G opacity={0.22}><Path d="M20 40H140M20 60H140M20 80H140" /></G>
    <Path d="M20 100H140M20 20V100" />
    <M kind="grow" origin={[41, 100]}><Rect x={34} y={78} width={14} height={22} rx={2} fill={c.l} /></M>
    <M kind="grow" delay={0.2} origin={[67, 100]}><Rect x={60} y={66} width={14} height={34} rx={2} fill={c.l} /></M>
    <M kind="grow" delay={0.4} origin={[93, 100]}><Rect x={86} y={50} width={14} height={50} rx={2} fill={c.l} /></M>
    <M kind="grow" delay={0.6} origin={[119, 100]}><Rect x={112} y={34} width={14} height={66} rx={2} fill={c.a} /></M>
    <D d="M41 66L67 54L93 38L119 22" stroke={c.a} duration={3.4} />
    <M kind="pl" origin={[41, 66]}><Circle cx={41} cy={66} r={4} fill={W} /></M>
    <M kind="pl" delay={0.2} origin={[67, 54]}><Circle cx={67} cy={54} r={4} fill={W} /></M>
    <M kind="pl" delay={0.4} origin={[93, 38]}><Circle cx={93} cy={38} r={4} fill={W} /></M>
    <M kind="pl" delay={0.6} origin={[119, 22]}><Circle cx={119} cy={22} r={4} fill={W} /></M>
  </>),

  // 3 IT & Technology — terminal types code, gear spins
  (c) => (<>
    <Rect x={18} y={16} width={112} height={76} rx={8} fill="#06101a" />
    <D d="M32 36h34" stroke={c.a} />
    <D d="M32 50h56" stroke={c.l} delay={0.7} />
    <D d="M32 64h26" stroke={c.a} delay={1.4} />
    <M kind="bl" duration={0.9}><Rect x={64} y={58} width={4} height={12} fill={c.a} stroke="none" /></M>
    <Path d="M74 108h30M89 92v16" />
    <M kind="spin" duration={5} origin={[130, 26]}>
      <Circle cx={130} cy={26} r={13} strokeWidth={7} strokeDasharray="6.5" stroke={c.a} />
    </M>
  </>),

  // 4 Customer Service — headset + pulsing chat bubble
  (c) => (<>
    <Path d="M38 72a34 34 0 0 1 68 0" />
    <Rect x={28} y={68} width={14} height={26} rx={6} fill={c.a} />
    <Rect x={102} y={68} width={14} height={26} rx={6} fill={c.a} />
    <Path d="M109 94q0 14-28 14" />
    <Rect x={72} y={104} width={16} height={9} rx={4} fill={c.l} />
    <M kind="pl" duration={1.8} origin={[114, 26]}>
      <Path d="M92 6h44a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-20l-10 9v-9H92a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill={W} />
    </M>
    <M kind="bl"><Path d="M100 22h.1" strokeWidth={6} /></M>
    <M kind="bl" delay={0.3}><Path d="M114 22h.1" strokeWidth={6} /></M>
    <M kind="bl" delay={0.6}><Path d="M128 22h.1" strokeWidth={6} /></M>
  </>),

  // 5 Hospitality & Food — serving dome lifts, steam rises
  (c) => (<>
    <Path d="M12 98h136" />
    <M kind="rise"><Path d="M66 52q-6-8 0-14" /></M>
    <M kind="rise" delay={1}><Path d="M94 52q-6-8 0-14" /></M>
    <Path d="M54 98q26-26 52 0" fill={c.a} />
    <M kind="lift">
      <Path d="M34 98a46 46 0 0 1 92 0z" fill={c.l} />
      <Path d="M80 52v-8m-6 0h12" />
    </M>
  </>),

  // 6 Retail & E-commerce — swinging bag and tag
  (c) => (<>
    <M kind="sw" duration={2.6} origin={[70, 38]}>
      <Path d="M34 46h72l8 58H26z" fill={c.a} />
      <Path d="M54 46v-8a16 16 0 0 1 32 0v8" />
      <Path d="M60 70q10 12 20 0" stroke={W} />
    </M>
    <M kind="sw" delay={0.4} origin={[130, 62]}>
      <Path d="M130 62v10" />
      <Rect x={120} y={72} width={20} height={26} rx={4} fill={c.l} />
    </M>
    <M kind="bl"><Path d="M124 22v14M117 29h14" /></M>
    <M kind="bl" delay={0.5}><Path d="M22 24v10M17 29h10" /></M>
  </>),

  // 7 Logistics & Delivery — truck rides ON the road: wheels touch the road line
  (c) => (<>
    {/* ground line the wheels sit on, plus moving dashes underneath */}
    <Path d="M0 100H160" />
    <M kind="road"><Path d="M0 110h22M40 110h22M80 110h22M120 110h22M160 110h22" /></M>
    {/* body suspension: tiny bounce, wheels stay planted */}
    <M kind="bob" amp={1.4} duration={0.4}>
      <Rect x={10} y={38} width={70} height={46} rx={5} fill={c.l} />
      <Path d="M80 52h28l16 18v14H80z" fill={c.a} />
      <Path d="M92 58h12l8 10H92z" fill={W} />
    </M>
    <M kind="spin" duration={0.7} origin={[32, 90]}><Circle cx={32} cy={90} r={10} fill={W} strokeDasharray="9.4" /></M>
    <M kind="spin" duration={0.7} origin={[104, 90]}><Circle cx={104} cy={90} r={10} fill={W} strokeDasharray="9.4" /></M>
    <Circle cx={32} cy={90} r={3} fill={c.i} />
    <Circle cx={104} cy={90} r={3} fill={c.i} />
  </>),

  // 8 Admin & Office — clipboard, checks tick off in turn
  (c) => (<>
    <Rect x={36} y={16} width={88} height={96} rx={9} fill={W} />
    <Rect x={62} y={8} width={36} height={16} rx={6} fill={c.a} />
    <D d="M48 46l6 6 11-13" stroke={c.a} />
    <Path d="M74 46h38" />
    <D d="M48 70l6 6 11-13" stroke={c.a} delay={0.8} />
    <Path d="M74 70h30" />
    <D d="M48 94l6 6 11-13" stroke={c.a} delay={1.6} />
    <Path d="M74 94h34" />
  </>),

  // 9 Human Resources — three people bob in turn, star spins
  (c) => (<>
    <M kind="bob"><Circle cx={40} cy={62} r={11} fill={c.l} /><Path d="M20 106a20 20 0 0 1 40 0z" fill={c.l} /></M>
    <M kind="bob" delay={0.35}><Circle cx={80} cy={54} r={13} fill={c.a} /><Path d="M56 106a24 24 0 0 1 48 0z" fill={c.a} /></M>
    <M kind="bob" delay={0.7}><Circle cx={120} cy={62} r={11} fill={c.l} /><Path d="M100 106a20 20 0 0 1 40 0z" fill={c.l} /></M>
    <M kind="spin" duration={5} origin={[80, 17]}><Path d="M80 4l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill={W} /></M>
  </>),

  // 10 Education & Training — cap bobs, book page flips
  (c) => (<>
    <M kind="bob">
      <Path d="M80 6l38 14-38 14-38-14z" fill={c.a} />
      <Path d="M62 30v10q18 8 36 0V30" />
    </M>
    <Path d="M80 108V62q-24-10-52-4v48q28-6 52 2zM80 108V62q24-10 52-4v48q-28-6-52 2z" fill={c.l} />
    <M kind="pg" origin={[80, 85]}><Path d="M80 108V62q24-10 52-4v48q-28-6-52 2z" fill={W} /></M>
  </>),

  // 11 Engineering & Construction — crane swings its load
  (c) => (<>
    <Path d="M14 110h110" />
    <Path d="M42 110V16h10v94M42 16h100M42 30l10 14-10 14 10 14-10 14 10 14" />
    <Rect x={128} y={18} width={14} height={22} fill={c.l} />
    <Path d="M70 110v-24h26v24" fill={c.l} />
    <M kind="sw" duration={2.6} origin={[110, 16]}>
      <Path d="M110 16v40" />
      <Rect x={98} y={56} width={26} height={16} fill={c.a} />
    </M>
  </>),

  // 12 Design & Creative — bezier draws itself, anchors pulse, swatches bob
  (c) => (<>
    <D d="M20 92C34 14 86 112 138 28" stroke={c.a} strokeWidth={5} duration={3.4} len={240} />
    <Path d="M20 92l-8-24M138 28l10 22" strokeWidth={2} />
    <M kind="pl" origin={[19, 93]}><Rect x={14} y={88} width={10} height={10} fill={W} /></M>
    <M kind="pl" delay={0.5} origin={[138, 28]}><Rect x={133} y={23} width={10} height={10} fill={W} /></M>
    <M kind="pl" delay={0.2} origin={[10.5, 66.5]}><Rect x={6} y={62} width={9} height={9} fill={c.l} /></M>
    <M kind="pl" delay={0.7} origin={[147.5, 52.5]}><Rect x={143} y={48} width={9} height={9} fill={c.l} /></M>
    <M kind="bob"><Rect x={40} y={96} width={18} height={14} rx={3} fill={c.a} /></M>
    <M kind="bob" delay={0.2}><Rect x={64} y={96} width={18} height={14} rx={3} fill={c.l} /></M>
    <M kind="bob" delay={0.4}><Rect x={88} y={96} width={18} height={14} rx={3} fill={W} /></M>
  </>),

  // 13 Healthcare — pulsing cross over a heartbeat line
  (c) => (<>
    <M kind="pl" duration={1.2} origin={[80, 42]}><Path d="M68 8h24v22h22v24H92v22H68V54H46V30h22z" fill={c.a} /></M>
    <D d="M8 100h40l10-20 16 40 12-30 8 10h58" duration={2.4} len={220} />
  </>),

  // 14 Manufacturing — meshing gears over a conveyor
  (c) => (<>
    <M kind="spin" duration={5} origin={[54, 46]}><Circle cx={54} cy={46} r={24} fill={c.l} strokeWidth={10} strokeDasharray="10.05" /></M>
    <M kind="spin" duration={3.3} dir={-1} origin={[108, 62]}><Circle cx={108} cy={62} r={16} fill={c.a} strokeWidth={8} strokeDasharray="6.7" /></M>
    <M kind="road"><Path d="M0 100h20M40 100h20M80 100h20M120 100h20M160 100h20" strokeWidth={5} /></M>
    <Rect x={0} y={106} width={150} height={6} fill={c.l} stroke="none" />
  </>),

  // 15 Beauty & Personal Care — makeup: lipstick twists up, compact mirror glints, brush sweeps
  (c) => (<>
    <M kind="grow" duration={2.4} origin={[41, 64]}><Path d="M34 64V50q0-9 7-13 7 4 7 13v14z" fill={c.a} /></M>
    <Rect x={28} y={62} width={26} height={12} rx={2} fill={c.l} />
    <Rect x={30} y={74} width={22} height={32} rx={3} fill={c.a} />
    <Rect x={66} y={56} width={56} height={50} rx={14} fill={c.l} />
    <Circle cx={94} cy={81} r={18} fill={W} />
    <M kind="bl" duration={1.6}><Path d="M86 75l8-7" /></M>
    <M kind="sw" amp={10} duration={2} origin={[134, 14]}>
      <Path d="M134 14L114 54" strokeWidth={4} />
      <Path d="M108 52q-3 10 6 14 8-4 7-12z" fill={c.a} />
    </M>
    <M kind="bl"><Path d="M20 20v14M13 27h14" /></M>
    <M kind="bl" delay={0.6}><Path d="M80 18v10M75 23h10" stroke={c.a} /></M>
  </>),

  // 16 Cleaning & Housekeeping — broom sweeps, bubbles rise
  (c) => (<>
    <M kind="sw" duration={1.4} origin={[70, 6]}>
      <Path d="M70 6v62" />
      <Path d="M48 68h44l10 40H38z" fill={c.a} />
      <Path d="M54 80l-4 24M70 80v28M86 80l4 24" stroke={W} strokeWidth={2} />
    </M>
    <M kind="rise"><Circle cx={116} cy={90} r={6} /></M>
    <M kind="rise" delay={1}><Circle cx={130} cy={74} r={4} /></M>
    <M kind="rise" delay={2}><Circle cx={122} cy={100} r={3} /></M>
    <M kind="bl"><Path d="M120 30v14M113 37h14" /></M>
    <M kind="bl" delay={0.7}><Path d="M26 40v12M20 46h12" /></M>
  </>),

  // 17 Security — CCTV camera sweeping at the top, shield with scanner below
  (c) => (<>
    <Rect x={146} y={6} width={6} height={42} rx={2} fill={c.l} />
    <Path d="M134 27h12" />
    <M kind="sw" amp={6} duration={3} origin={[134, 27]}>
      <Path d="M82 27L40 10V44z" fill={c.a} fillOpacity={0.3} stroke="none" />
      <Rect x={88} y={16} width={46} height={22} rx={6} fill={c.l} />
      <Rect x={82} y={20} width={8} height={14} rx={2} fill={c.a} />
      <M kind="bl" duration={0.8}><Circle cx={126} cy={22} r={2.5} fill="#ff3b30" stroke="none" /></M>
    </M>
    <Path d="M60 52l28 10v22c0 18-12 28-28 34-16-6-28-16-28-34V62z" fill={c.l} />
    <D d="M46 84l10 10 18-22" stroke={c.a} strokeWidth={6} />
    <M kind="scan" amp={44}><Path d="M36 66h48" stroke={c.a} strokeWidth={2.5} /></M>
  </>),

  // 18 Agriculture — sprout grows and sways, sun spins
  (c) => (<>
    <Path d="M14 108h132" />
    <M kind="spin" duration={8} origin={[124, 26]}><Circle cx={124} cy={26} r={12} fill={c.l} strokeDasharray="5.4" strokeWidth={5} /></M>
    <Path d="M34 108q30-22 60 0z" fill={c.l} />
    <M kind="grow" duration={3.4} origin={[64, 108]}>
      <Path d="M64 108V52" />
      <M kind="sw" duration={2} origin={[64, 60]}>
        <Path d="M64 70q-30-2-34-26 28 0 34 26z" fill={c.l} />
        <Path d="M64 56q30-2 34-28-28 2-34 28z" fill={c.a} />
      </M>
    </M>
  </>),
];

type Props = { index: number; ink: string; accent: string; light: string; width?: number };

export function VistaScene({ index, ink, accent, light, width = 160 }: Props) {
  const scene = SCENES[index] ?? SCENES[0];
  return (
    <Svg width={width} height={(width * 120) / 160} viewBox="0 0 160 120">
      <G stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {scene({ i: ink, a: accent, l: light })}
      </G>
    </Svg>
  );
}
