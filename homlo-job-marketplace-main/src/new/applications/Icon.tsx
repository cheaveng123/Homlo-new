import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Thin line icons, 24 grid, 1.6 stroke, round caps.
// If the project's AppIcon already has these, swap ONLY this file's internals.
export type IconName =
  | 'back' | 'chevron' | 'check' | 'eye' | 'file' | 'chat' | 'search'
  | 'briefcase' | 'pin' | 'alert' | 'inbox' | 'sunrise';

const D: Record<IconName, string[]> = {
  back: ['M15 5l-7 7 7 7'],
  chevron: ['M9 5l7 7-7 7'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  file: ['M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z', 'M14 3v5h5M9 13h6M9 17h6'],
  chat: ['M20 12a8 8 0 01-11.6 7.1L4 20l1-4A8 8 0 1120 12z'],
  search: ['M18 11a7 7 0 11-14 0 7 7 0 0114 0z', 'M20 20l-4-4'],
  briefcase: ['M5 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 012-2V9a2 2 0 012-2z', 'M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2'],
  pin: ['M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z', 'M14.5 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z'],
  alert: ['M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'M12 8v5M12 16.5v.01'],
  inbox: ['M3 13l3-8h12l3 8v6a1 1 0 01-1 1H4a1 1 0 01-1-1z', 'M3 13h5l1 3h6l1-3h5'],
  sunrise: ['M3 18h18M6.5 18a5.5 5.5 0 0111 0M12 6v2M4.8 10.8l1.4 1.4M19.2 10.8l-1.4 1.4'],
};

export function Icon({ name, size = 20, color = '#12303C', strokeWidth = 1.6 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {D[name].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}