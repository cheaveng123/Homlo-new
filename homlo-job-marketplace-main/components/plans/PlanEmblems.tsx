// Soft abstract plan emblems (inspired by the approved pricing reference):
// one shape per plan in its accent color, drawn with radial gradients so the
// edges glow softly. 72x72 by default. No stickers, no shadows.
import React from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

type E = { size?: number };

/** Free: a four-petal blossom in warm amber. */
export const BlossomEmblem = ({ size = 72 }: E) => (
  <Svg width={size} height={size} viewBox="0 0 72 72">
    <Defs>
      <RadialGradient id="emA" cx="50%" cy="50%" r="55%">
        <Stop offset="0" stopColor="#FFC765" />
        <Stop offset="0.65" stopColor="#F5A524" />
        <Stop offset="1" stopColor="#E8870F" stopOpacity={0.85} />
      </RadialGradient>
    </Defs>
    <G opacity={0.95}>
      {[0, 90, 180, 270].map((r) => (
        <Path key={r} d="M36 36C27 30 26 14 36 10C46 14 45 30 36 36Z" fill="url(#emA)" transform={`rotate(${r + 20} 36 36)`} />
      ))}
    </G>
    <Circle cx={36} cy={36} r={6} fill="#FFF3DC" opacity={0.9} />
  </Svg>
);

/** Pro: a six-lobed clover in cyan. */
export const CloverEmblem = ({ size = 72 }: E) => (
  <Svg width={size} height={size} viewBox="0 0 72 72">
    <Defs>
      <RadialGradient id="emB" cx="50%" cy="50%" r="55%">
        <Stop offset="0" stopColor="#8BD3E3" />
        <Stop offset="0.6" stopColor="#0891B2" />
        <Stop offset="1" stopColor="#0B6F8A" stopOpacity={0.9} />
      </RadialGradient>
    </Defs>
    {[0, 60, 120, 180, 240, 300].map((r) => (
      <Path key={r} d="M36 36C30 31 29 18 36 14C43 18 42 31 36 36Z" fill="url(#emB)" transform={`rotate(${r} 36 36)`} opacity={0.92} />
    ))}
    <Circle cx={36} cy={36} r={4.5} fill="#E6F7FB" />
  </Svg>
);

/** Enterprise: a butterfly-like pair of wings in navy with cyan light. */
export const WingsEmblem = ({ size = 72 }: E) => (
  <Svg width={size} height={size} viewBox="0 0 72 72">
    <Defs>
      <RadialGradient id="emC" cx="35%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#3FC1DB" />
        <Stop offset="0.55" stopColor="#21486A" />
        <Stop offset="1" stopColor="#14324A" />
      </RadialGradient>
      <RadialGradient id="emD" cx="65%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#3FC1DB" />
        <Stop offset="0.55" stopColor="#21486A" />
        <Stop offset="1" stopColor="#14324A" />
      </RadialGradient>
    </Defs>
    <Path d="M35 36C28 22 16 12 11 18C6 25 15 33 24 36C15 39 6 47 11 54C16 60 28 50 35 36Z" fill="url(#emC)" />
    <Path d="M37 36C44 22 56 12 61 18C66 25 57 33 48 36C57 39 66 47 61 54C56 60 44 50 37 36Z" fill="url(#emD)" />
    <Path d="M36 26v20" stroke="#F5A524" strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export function PlanEmblem({ id, index, size }: { id: string; index: number; size?: number }) {
  const key = id === 'free' ? 0 : id === 'pro' ? 1 : id === 'enterprise' ? 2 : index % 3;
  if (key === 0) return <BlossomEmblem size={size} />;
  if (key === 1) return <CloverEmblem size={size} />;
  return <WingsEmblem size={size} />;
}
