import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { colorsNew, typeScaleNew, TextVariantNew } from '../theme/tokensNew';
import { familyNew, WeightNew } from '../theme/fontsNew';

const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
export const hasKhmerNew = (s: unknown) => typeof s === 'string' && KHMER.test(s);

function flatten(children: React.ReactNode): string {
  return React.Children.toArray(children).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');
}

export type TextNewProps = TextProps & {
  variant?: TextVariantNew;
  weight?: WeightNew;
  /** Plus Jakarta Sans. Default true for hero/header/section. */
  heading?: boolean;
  color?: string;
  align?: TextStyle['textAlign'];
};

/**
 * Every piece of text in the *New screens goes through this.
 * - Latin: Plus Jakarta Sans (headings 700/800) and Inter (body/UI 400/500/600).
 * - Khmer is detected automatically and uses Noto Sans Khmer at the matching weight, with taller line height.
 * - Font scale is capped at 130% so layouts never clip.
 */
export function TextNew({ variant = 'body', weight, heading, color = colorsNew.text, align, style, children, ...rest }: TextNewProps) {
  const isHeading = heading ?? (variant === 'hero' || variant === 'header' || variant === 'section');
  const w: WeightNew = weight ?? (isHeading ? 'extrabold' : 'regular');
  const khmer = KHMER.test(flatten(children));
  const family = khmer ? familyNew.khmer[w] : isHeading ? familyNew.heading[w] : familyNew.body[w];
  const { size, line } = typeScaleNew[variant];
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[{ fontFamily: family, fontSize: size, lineHeight: khmer ? Math.round(line * 1.25) : line, color, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
