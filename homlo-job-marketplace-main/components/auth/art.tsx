/**
 * components/auth/art.tsx
 *
 * The illustration pieces for the auth screen's hero (and its two lower
 * framing elements). Ported 1:1 from the approved design reference — the
 * artwork, its geometry and its colours are untouched, so nothing here should
 * be restyled or merged into one combined image.
 *
 * Every piece is its own component and its own <Svg>. Each takes `size` as a
 * *width* in points and derives its height from the viewBox aspect ratio, so
 * callers only ever scale the whole composition with one `k` multiplier.
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

type ArtProps = { size: number };

/** Width/height pair for a viewBox of `vw` x `vh` at a rendered width of `size`. */
const box = (size: number, vw: number, vh: number) => ({ width: size, height: (size * vh) / vw });

export function BriefcaseArt({ size }: ArtProps) {
  return (
    <Svg {...box(size, 60, 50)} viewBox="0 0 60 50">
      <Path d="M20 12v-3a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v3" fill="none" stroke="#0A4A3A" strokeWidth={4} />
      <Rect x={0} y={12} width={60} height={36} rx={7} fill="#0F6E56" />
      <Path d="M0 28h60" stroke="#0A4A3A" strokeWidth={3} />
      <Rect x={25} y={24} width={10} height={9} rx={2} fill="#F0B04A" />
    </Svg>
  );
}

export function PinArt({ size }: ArtProps) {
  return (
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
}

export function Character1Art({ size }: ArtProps) {
  return (
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
}

export function Character2Art({ size }: ArtProps) {
  return (
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
}

export function JobCardArt({ size }: ArtProps) {
  return (
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
}

export function SearchArt({ size }: ArtProps) {
  return (
    <Svg {...box(size, 40, 40)} viewBox="0 0 40 40">
      <Circle cx={17} cy={17} r={11} fill="#FBF7EE" stroke="#0F6E56" strokeWidth={5} />
      <Path d="M26 26l11 11" stroke="#F0B04A" strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

export function LaptopArt({ size }: ArtProps) {
  return (
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
}

export function CalendarArt({ size }: ArtProps) {
  return (
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
}

/** `flip` mirrors the sparkle horizontally for the hero's second accent. */
export function SparkArt({ size, flip }: ArtProps & { flip?: boolean }) {
  return (
    <Svg
      {...box(size, 24, 24)}
      viewBox="0 0 24 24"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path d="M4 18 8 14M10 8V3M18 12l4-1" stroke="#F0B04A" strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
