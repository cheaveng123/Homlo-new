// Map icon for a job: the app's secondary job-field icon set
// (components/shared/JobFieldGlyphs.tsx: navy duotone line, cyan-tint fill, one
// amber accent), resolved from whatever spelling the job's category arrives in.
// Unmapped categories get a briefcase drawn in the same style instead of that
// set's search fallback, which would read as "search" on a map.
import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

import { JobFieldGlyph as FieldIcon } from "@/components/shared/JobFieldGlyphs";
import { resolveJobField } from "@/lib/job-fields";
import { palette } from "@/src/design/tokens";

const line = { fill: "none", stroke: palette.navy, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Briefcase({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={7.5} width={17} height={12} rx={2.4} {...line} fill={palette.cyanTint} />
      <Path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" {...line} />
      <Path d="M3.5 12.5h17" {...line} />
      <Path d="M12 11.3v2.6" {...line} stroke={palette.amber} strokeWidth={2} />
    </Svg>
  );
}

export const JobFieldGlyph = React.memo(function JobFieldGlyph({
  category,
  size = 18,
}: {
  category?: string | null;
  size?: number;
}) {
  const field = resolveJobField(category);
  return field ? <FieldIcon id={field.id} size={size} /> : <Briefcase size={size} />;
});
