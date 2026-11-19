// Employer picture: the real photo/logo when there is one, otherwise a
// geometric mark (picked from the company name) on a soft navy, cyan or amber tint.
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { AP, hashOf } from './tokens';

const NAVY_TINT = '#E8EEF3';
const AMBER_TINT = '#FFF1D6';

const MARKS: { bg: string; draw: React.ReactNode }[] = [
  { bg: NAVY_TINT, draw: <><Circle cx={20} cy={20} r={9} fill="none" stroke={AP.navy} strokeWidth={3.5} /><Circle cx={20} cy={20} r={3} fill={AP.amber} /></> },
  { bg: AP.tint, draw: <Path d="M9 28V16M16 28V10M23 28V18M30 28V13" stroke={AP.navy} strokeWidth={4} strokeLinecap="round" /> },
  { bg: AMBER_TINT, draw: <><Path d="M20 8l11 12-11 12L9 20z" fill={AP.navy} /><Circle cx={20} cy={20} r={3.5} fill={AP.amber} /></> },
  { bg: AP.tint, draw: <><Path d="M20 31c-9 0-12-8-11-15 8 0 14 3 14 11z" fill={AP.cyan} /><Path d="M12 28l9-9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" /></> },
  { bg: NAVY_TINT, draw: <Path d="M8 16c4-5 8-5 12 0s8 5 12 0M8 25c4-5 8-5 12 0s8 5 12 0" fill="none" stroke={AP.cyanDeep} strokeWidth={3.4} strokeLinecap="round" /> },
  { bg: AP.tint, draw: <><Path d="M20 9l12 21H8z" fill={AP.navy} /><Path d="M20 18l5 9h-10z" fill={AP.tint} /></> },
  { bg: NAVY_TINT, draw: <><Path d="M20 8l10 6v12l-10 6-10-6V14z" fill="none" stroke={AP.navy} strokeWidth={3} /><Path d="M20 15v10" stroke={AP.amber} strokeWidth={3} strokeLinecap="round" /></> },
  { bg: AMBER_TINT, draw: <><Rect x={9} y={9} width={10} height={10} rx={3} fill={AP.navy} /><Rect x={21} y={21} width={10} height={10} rx={3} fill={AP.navy} /><Rect x={21} y={9} width={10} height={10} rx={3} fill={AP.amber} /></> },
];

type Props = { company: string; uri?: string | null; size: number; radius: number };

export function LogoMark({ company, uri, size, radius }: Props) {
  const [failed, setFailed] = useState(false);
  const mark = MARKS[hashOf(company) % MARKS.length];
  const showPhoto = !!uri && !failed;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: radius, overflow: 'hidden',
        backgroundColor: showPhoto ? AP.bg : mark.bg, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {showPhoto ? (
        <Image source={{ uri: uri! }} style={{ width: size, height: size }} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 40 40">
          {mark.draw}
        </Svg>
      )}
    </View>
  );
}
