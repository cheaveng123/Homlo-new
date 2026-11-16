import React from "react";

/**
 * RecommendHeroV4 – city background + 4 rotating activity scenes.
 *
 *   <header style={{ position: "relative", height: 240, overflow: "hidden" }}>
 *     <RecommendHeroV4 />
 *     <div style={{ position: "relative" }}> ...header text... </div>
 *   </header>
 *
 * Scenes (5s each, 20s loop): Café -> Hotel -> Retail -> Delivery.
 * Each scene has two people doing a job. A check bubble appears over one
 * person, then the other (one at a time, no numbers). Scenes slide/fade.
 * prefers-reduced-motion: shows the café scene, first bubble, no movement.
 */

type Props = { animate?: boolean; className?: string };

const SCENE = 5;
const EYE = "#2B1A10";
const BLUSH = "#F2A08A";
const SPARK = "M0 -5 Q0 0 5 0 Q0 0 0 5 Q0 0 -5 0 Q0 0 0 -5Z";

/* ---------- city (persistent) ---------- */
const FAR: [number, number, number][] = [
  [0, 30, 122], [30, 24, 102], [54, 34, 136], [88, 28, 112], [120, 36, 128],
  [156, 26, 96], [218, 28, 106], [246, 34, 132], [280, 26, 100],
  [306, 32, 118], [338, 28, 92], [366, 28, 124],
];
const NEAR: [number, number, number][] = [
  [8, 40, 152], [54, 30, 140], [90, 44, 162], [142, 30, 146],
  [176, 38, 156], [226, 34, 142], [264, 40, 152], [310, 30, 144], [346, 44, 154],
];
const LIT: [number, number, number][] = [
  [20, 164, 0], [100, 178, 0.8], [188, 168, 1.6], [238, 158, 0.4], [326, 154, 1.2],
];

/* ---------- building blocks ---------- */
type PersonProps = {
  x: number;
  skin: string;
  shade: string;
  hair: string;
  top: string;
  topShade: string;
  style?: "short" | "long" | "bun" | "cap";
  cap?: string;
  delay?: number;
};

function Person({ x, skin, shade, hair, top, topShade, style = "short", cap, delay = 0 }: PersonProps) {
  const d = { animationDelay: `${delay}s` };
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="rh-breathe" style={d}>
        <rect x="-5.5" y="182" width="11" height="16" rx="3" fill={shade} />
        <path d="M-34 240 C-34 206 -20 192 0 192 C20 192 34 206 34 240Z" fill={top} />
        <path d="M0 192 C20 192 34 206 34 240 H12 C14 214 8 198 0 192Z" fill={topShade} />
        <path d="M-7 192 L0 203 L7 192Z" fill="#FFFFFF" opacity=".92" />
        <g className="rh-nod" style={d}>
          {style === "long" && (
            <path d="M-19 170 C-22 148 -10 145 0 145 C10 145 22 148 19 170 L22 200 L-22 200Z" fill={hair} />
          )}
          {style === "bun" && <circle cx="0" cy="145" r="6.5" fill={hair} />}
          <circle cx="-15" cy="170" r="2.6" fill={skin} />
          <circle cx="15" cy="170" r="2.6" fill={skin} />
          <ellipse cx="0" cy="168" rx="15" ry="17" fill={skin} />
          <circle cx="-9" cy="174" r="2.6" fill={BLUSH} opacity=".35" />
          <circle cx="9" cy="174" r="2.6" fill={BLUSH} opacity=".35" />
          <g className="rh-blink" style={d}>
            <circle cx="-5.5" cy="168" r="1.6" fill={EYE} />
            <circle cx="5.5" cy="168" r="1.6" fill={EYE} />
          </g>
          <path d="M-4.5 174 Q0 178.5 4.5 174" fill="none" stroke={EYE} strokeWidth="1.3" strokeLinecap="round" />
          {style === "cap" ? (
            <>
              <path d="M-16 164 C-17 146 -7 144 0 144 C8 144 17 147 16 164Z" fill={cap} />
              <ellipse cx="0" cy="163" rx="17.5" ry="3" fill={cap} />
            </>
          ) : (
            <path
              d="M-16 167 C-18 147 -6 147 0 147 C9 147 18 150 16 167 C12 159 5 156 -1 156 C-8 157 -13 160 -16 167Z"
              fill={hair}
            />
          )}
        </g>
      </g>
    </g>
  );
}

function Arm(p: { from: [number, number]; to: [number, number]; sleeve: string; skin: string }) {
  return (
    <>
      <path d={`M${p.from[0]} ${p.from[1]} L${p.to[0]} ${p.to[1]}`} stroke={p.sleeve} strokeWidth="9" strokeLinecap="round" />
      <circle cx={p.to[0]} cy={p.to[1]} r="4.5" fill={p.skin} />
    </>
  );
}

function Counter({ y, color, lip }: { y: number; color: string; lip: string }) {
  return (
    <>
      <rect x="246" y={y} width="150" height={240 - y} rx="4" fill={color} />
      <rect x="246" y={y} width="150" height="5" rx="2.5" fill={lip} />
    </>
  );
}

function Bubble({ x, which, i }: { x: number; which: "a" | "b"; i: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className={`rh-pop rh-pop-${which}`} style={{ animationDelay: `${i * SCENE}s` }}>
        <g className="rh-float">
          <rect x="-18" y="92" width="36" height="30" rx="12" fill="#FFFFFF" />
          <path d="M-5 121 L0 132 L5 121Z" fill="#FFFFFF" />
          <circle cx="0" cy="107" r="9.5" fill="#137A87" />
          <path
            d="M-4.6 107.4 L-1.4 110.6 L4.8 103.6"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  );
}

function Scene({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <g className={`rh-scene rh-scene-${i}`} style={{ animationDelay: `${i * SCENE}s` }}>
      {children}
      <Bubble x={292} which="a" i={i} />
      <Bubble x={348} which="b" i={i} />
    </g>
  );
}

/* ---------- scenes ---------- */
function Cafe() {
  return (
    <Scene i={0}>
      <Person x={292} skin="#EDBB8E" shade="#D9A276" hair="#4A2C1A" top="#F2F2EE" topShade="#DADAD4" delay={0} />
      <path d="M280 196 L304 196 L307 212 H277Z" fill="#8B5E3C" />
      <path d="M286 190 L281 197 M298 190 L303 197" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
      <Person x={348} skin="#D59D70" shade="#BE8559" hair="#1F1A1A" top="#E8745F" topShade="#CC5E4A" style="long" delay={-1.2} />
      <g className="rh-lift">
        <Arm from={[313, 214]} to={[308, 200]} sleeve="#F2F2EE" skin="#EDBB8E" />
        <Arm from={[328, 214]} to={[333, 200]} sleeve="#E8745F" skin="#D59D70" />
      </g>
      <Counter y={208} color="#B9824F" lip="#DDA56C" />
      <g className="rh-lift">
        <g transform="translate(320 203)">
          <path d="M-6 -10 H6 L4.5 0 H-4.5Z" fill="#FFFFFF" />
          <rect x="-5.4" y="-6" width="10.8" height="2.6" fill="#F5B731" />
        </g>
      </g>
      {[0, 0.6, 1.2].map((d, k) => (
        <path
          key={k}
          className="rh-steam"
          style={{ animationDelay: `${d}s` }}
          d={`M${316 + k * 4} 190 q-3 -3 0 -6`}
          stroke="#FFFFFF"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </Scene>
  );
}

function Hotel() {
  return (
    <Scene i={1}>
      <Person x={292} skin="#F0C7A0" shade="#DBAE86" hair="#7A3F25" top="#2D3F6B" topShade="#233255" style="bun" delay={0} />
      <Person x={348} skin="#B97C55" shade="#A2683F" hair="#1A1512" top="#6FB5A8" topShade="#57998C" delay={-1.2} />
      <g className="rh-tap">
        <Arm from={[312, 214]} to={[322, 194]} sleeve="#2D3F6B" skin="#F0C7A0" />
      </g>
      <Arm from={[370, 214]} to={[372, 190]} sleeve="#6FB5A8" skin="#B97C55" />
      <Counter y={206} color="#D9826B" lip="#EBA08A" />
      <g transform="translate(322 206)">
        <path d="M-7 0 A7 7 0 0 1 7 0Z" fill="#F5B731" />
        <rect x="-9" y="0" width="18" height="2.6" rx="1" fill="#D99A1E" />
        <rect x="-1" y="-10" width="2" height="3" fill="#D99A1E" />
      </g>
      <g className="rh-ding" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round">
        <path d="M311 198 q-3 3 0 7" />
        <path d="M333 198 q3 3 0 7" />
      </g>
      <rect x="360" y="190" width="24" height="16" rx="3" fill="#D9573F" />
      <path d="M368 190 v-4 h8 v4" fill="none" stroke="#7A2E20" strokeWidth="1.6" />
      <path d="M367 190 v16 M377 190 v16" stroke="#B8432F" strokeWidth="1.5" />
    </Scene>
  );
}

function Retail() {
  return (
    <Scene i={2}>
      <Person x={292} skin="#D8A276" shade="#C28B60" hair="#2A2A2A" top="#8F7BC4" topShade="#7765AB" style="cap" cap="#5E4C9A" delay={0} />
      <Person x={348} skin="#EDBB8E" shade="#D9A276" hair="#6B3E26" top="#F5B731" topShade="#DB9E18" style="long" delay={-1.2} />
      <g className="rh-tap">
        <Arm from={[314, 214]} to={[330, 192]} sleeve="#8F7BC4" skin="#D8A276" />
      </g>
      <Arm from={[372, 214]} to={[376, 196]} sleeve="#F5B731" skin="#EDBB8E" />
      <Counter y={208} color="#6E5AA8" lip="#8F7BC4" />
      <rect x="312" y="196" width="26" height="12" rx="2" fill="#33485A" />
      <rect x="314" y="188" width="13" height="9" rx="1.5" fill="#BFE8E4" />
      <rect x="316" y="191" width="8" height="2" rx="1" fill="#F5B731" />
      <g className="rh-swing" transform="translate(376 198)">
        <path d="M-9 2 H9 L8 18 H-8Z" fill="#F08A4B" />
        <path d="M-4 2 q4 -9 8 0" fill="none" stroke="#B8602A" strokeWidth="1.6" />
      </g>
    </Scene>
  );
}

function Delivery() {
  return (
    <Scene i={3}>
      <Person x={292} skin="#C98A62" shade="#B5764F" hair="#1A1512" top="#F08A4B" topShade="#D6733A" style="cap" cap="#2F5BB0" delay={0} />
      <Person x={348} skin="#EDBB8E" shade="#D9A276" hair="#1F1A1A" top="#3E8E7E" topShade="#2F776A" style="bun" delay={-1.2} />
      <g className="rh-box">
        <Arm from={[313, 216]} to={[309, 204]} sleeve="#F08A4B" skin="#C98A62" />
        <Arm from={[328, 216]} to={[332, 204]} sleeve="#3E8E7E" skin="#EDBB8E" />
      </g>
      <Counter y={214} color="#2FA39A" lip="#58C2B8" />
      <g className="rh-box">
        <rect x="310" y="188" width="20" height="16" rx="1.5" fill="#F4AE78" />
        <rect x="318" y="188" width="4" height="16" fill="#F7D27A" />
        <rect x="310" y="188" width="20" height="4" fill="#F9C58F" />
      </g>
      <g className="rh-bob" transform="translate(320 168)">
        <circle cx="0" cy="0" r="5.5" fill="#F5B731" />
        <circle cx="0" cy="0" r="2" fill="#1F5865" />
        <path d="M-4.6 3 L0 11 L4.6 3Z" fill="#F5B731" />
      </g>
    </Scene>
  );
}

/* ---------- main ---------- */
export default function RecommendHeroV4({ animate = true, className }: Props) {
  return (
    <svg
      className={`rh ${animate ? "rh--on" : ""} ${className ?? ""}`}
      viewBox="0 0 390 240"
      preserveAspectRatio="xMaxYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, display: "block" }}
    >
      <style>{`
        .rh * { transform-box: fill-box; }
        .rh .rh-scene { opacity: 0; }
        .rh .rh-scene-0 { opacity: 1; }
        .rh .rh-pop-a { opacity: 1; }
        .rh .rh-pop-b { opacity: 0; }
        .rh .rh-ding { opacity: 0; }
        .rh--on .rh-scene   { animation: rh-scene 20s ease-in-out infinite both; }
        .rh--on .rh-pop     { transform-origin: 50% 100%; }
        .rh--on .rh-pop-a   { animation: rh-pop-a 20s ease-out infinite both; }
        .rh--on .rh-pop-b   { animation: rh-pop-b 20s ease-out infinite both; }
        .rh--on .rh-float   { animation: rh-float 3s ease-in-out infinite; }
        .rh--on .rh-breathe { animation: rh-breathe 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
        .rh--on .rh-nod     { animation: rh-nod 3.2s ease-in-out infinite; transform-origin: 50% 95%; }
        .rh--on .rh-blink   { animation: rh-blink 4.5s infinite; transform-origin: 50% 50%; }
        .rh--on .rh-lift    { animation: rh-lift 1.8s ease-in-out infinite; }
        .rh--on .rh-box     { animation: rh-lift 2.2s ease-in-out infinite; }
        .rh--on .rh-tap     { animation: rh-tap .9s ease-in-out infinite; }
        .rh--on .rh-ding    { animation: rh-ding .9s ease-in-out infinite; }
        .rh--on .rh-swing   { animation: rh-swing 2s ease-in-out infinite; transform-origin: 50% 0%; }
        .rh--on .rh-bob     { animation: rh-float 1.6s ease-in-out infinite; }
        .rh--on .rh-steam   { animation: rh-steam 2s ease-out infinite; }
        .rh--on .rh-lit     { animation: rh-lit 3.4s ease-in-out infinite; }
        .rh--on .rh-beacon  { animation: rh-beacon 2s ease-in-out infinite; }
        .rh--on .rh-star    { animation: rh-star 2.8s ease-in-out infinite; transform-origin: 50% 50%; }
        @keyframes rh-scene {
          0%   { opacity: 0; transform: translateX(26px); }
          4%   { opacity: 1; transform: translateX(0); }
          21%  { opacity: 1; transform: translateX(0); }
          25%  { opacity: 0; transform: translateX(-26px); }
          100% { opacity: 0; transform: translateX(-26px); }
        }
        @keyframes rh-pop-a {
          0%,4%    { transform: scale(0); opacity: 0; }
          6%       { transform: scale(1.15); opacity: 1; }
          8%,13%   { transform: scale(1); opacity: 1; }
          15%,100% { transform: scale(.6); opacity: 0; }
        }
        @keyframes rh-pop-b {
          0%,13%   { transform: scale(0); opacity: 0; }
          15%      { transform: scale(1.15); opacity: 1; }
          17%,21%  { transform: scale(1); opacity: 1; }
          23%,100% { transform: scale(.6); opacity: 0; }
        }
        @keyframes rh-float   { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-2.5px);} }
        @keyframes rh-breathe { 0%,100% { transform: scaleY(1);} 50% { transform: scaleY(1.025);} }
        @keyframes rh-nod     { 0%,100% { transform: rotate(-2.5deg);} 50% { transform: rotate(2.5deg);} }
        @keyframes rh-blink   { 0%,92%,100% { transform: scaleY(1);} 95% { transform: scaleY(.1);} }
        @keyframes rh-lift    { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-3px);} }
        @keyframes rh-tap     { 0%,100% { transform: translateY(0);} 50% { transform: translateY(3px);} }
        @keyframes rh-ding    { 0%,40%,100% { opacity: 0;} 55% { opacity: 1;} }
        @keyframes rh-swing   { 0%,100% { transform: rotate(-7deg);} 50% { transform: rotate(7deg);} }
        @keyframes rh-steam   { 0% { opacity: 0; transform: translateY(2px);} 30% { opacity: .85;} 100% { opacity: 0; transform: translateY(-8px);} }
        @keyframes rh-lit     { 0%,100% { opacity: .35;} 50% { opacity: 1;} }
        @keyframes rh-beacon  { 0%,100% { opacity: .2;} 50% { opacity: 1;} }
        @keyframes rh-star    { 0%,100% { opacity: .3; transform: scale(.6);} 50% { opacity: 1; transform: scale(1);} }
        @media (prefers-reduced-motion: reduce) { .rh * { animation: none !important; } }
      `}</style>

      <defs>
        <linearGradient id="rh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A4854" />
          <stop offset="1" stopColor="#317F8B" />
        </linearGradient>
        <pattern id="rh-win" width="8" height="10" patternUnits="userSpaceOnUse">
          <rect x="2" y="3" width="3" height="4" fill="#FFFFFF" opacity=".09" />
        </pattern>
      </defs>

      {/* sky, moon, stars */}
      <rect width="390" height="240" fill="url(#rh-sky)" />
      <circle cx="330" cy="36" r="9" fill="#F7E7B0" opacity=".95" />
      <g transform="translate(236 40) scale(.9)">
        <path className="rh-star" d={SPARK} fill="#F5B731" />
      </g>
      <g transform="translate(372 78) scale(.7)">
        <path className="rh-star" style={{ animationDelay: "1.3s" }} d={SPARK} fill="#FFFFFF" />
      </g>

      {/* far skyline + tower */}
      <g fill="#2B6D7A">
        {FAR.map(([x, w, t]) => (
          <rect key={`f${x}`} x={x} y={t} width={w} height={200 - t} />
        ))}
        <rect x="190" y="74" width="22" height="126" />
        <rect x="199" y="60" width="4" height="14" />
      </g>
      <circle className="rh-beacon" cx="201" cy="58" r="2.6" fill="#F5B731" />

      {/* near skyline */}
      <g fill="#215B68">
        {NEAR.map(([x, w, t]) => (
          <rect key={`n${x}`} x={x} y={t} width={w} height={200 - t} />
        ))}
      </g>
      <g fill="url(#rh-win)">
        {NEAR.map(([x, w, t]) => (
          <rect key={`w${x}`} x={x} y={t} width={w} height={200 - t} />
        ))}
      </g>
      {LIT.map(([x, y, d]) => (
        <rect key={`l${x}`} className="rh-lit" style={{ animationDelay: `${d}s` }} x={x} y={y} width="4" height="5" fill="#F5B731" />
      ))}

      {/* street */}
      <path d="M0 198 C90 190 200 204 390 192 V240 H0Z" fill="#17444F" />
      <path d="M0 198 C90 190 200 204 390 192" fill="none" stroke="#3A8794" strokeWidth="1.5" />

      {/* rotating activity scenes */}
      <Cafe />
      <Hotel />
      <Retail />
      <Delivery />
    </svg>
  );
}
