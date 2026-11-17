// Put at: src/new/components/NewSkeletons.tsx
// Skeletons for the new-design worker + employer screens.
// All numbers come from the Homlo layout inventory (Part B / Part C).
// Primitive: SkeletonNew (existing, honors reduced motion).
// Anything marked VERIFY was not fully specified in the inventory:
// Kilo must compare it with the real component and fix the SKELETON only.

import React from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SkeletonNew, cardBoxNew } from './PrimitivesNew';

type W = number | `${number}%`;
type Spec = { fs: number; lh: number };

// TextNew scale (fontSize / lineHeight) from the inventory
const T = {
  caption: { fs: 12, lh: 16 },
  meta: { fs: 13, lh: 18 },
  body: { fs: 14, lh: 20 },
  title: { fs: 16, lh: 22 },
  section: { fs: 17, lh: 24 },
  header: { fs: 20, lh: 28 },
  hero: { fs: 24, lh: 32 },
} as const;

const GUTTER = 16; // layoutNew.screenX
const DIVIDER = '#E6EDEF'; // card/divider border used in the new screens
const WHITE = '#FFFFFF';

/** One line of text: wrapper height = real lineHeight (no layout jump), bar = ~0.8 x fontSize. */
function Line({ width = '100%', spec, style }: { width?: W; spec: Spec; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: spec.lh, justifyContent: 'center' }, style]}>
      <SkeletonNew width={width} height={Math.round(spec.fs * 0.8)} radius={6} />
    </View>
  );
}

/* =====================================================================
   WORKER: CARDS AND ROWS
   ===================================================================== */

/** JobCardTallNew: width 210, image 200 r20, body pt12 px4 gap4 */
export function JobCardTallSkeleton({ width = 210 }: { width?: number }) {
  return (
    <View style={{ width }}>
      <SkeletonNew width={width} height={200} radius={20} />
      <View style={{ paddingTop: 12, paddingHorizontal: 4, gap: 4 }}>
        <Line width="80%" spec={T.title} />
        <Line width="55%" spec={T.meta} />
        <SkeletonNew width={84} height={6} radius={3} style={{ marginVertical: 4 }} />
        <Line width="40%" spec={T.title} />
      </View>
    </View>
  );
}

/** Home > Recommended (horizontal row, gap 12, px16) */
export function HomeRecommendedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <JobCardTallSkeleton key={i} />
      ))}
    </View>
  );
}

/** Home > Explore: horizontal card row, card width (screenWidth - 32 - 12) / 2, gap 12. */
export function HomeExploreGridSkeleton({ count = 4 }: { count?: number }) {
  const { width } = useWindowDimensions();
  const cardW = (width - 32 - 12) / 2;
  return (
    <View style={{ flexDirection: 'row', columnGap: 12, paddingHorizontal: GUTTER, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <JobCardTallSkeleton key={i} width={cardW} />
      ))}
    </View>
  );
}

/** JobRowNew: row gap12 py14 px16, thumb 56 r16, divider 1. VERIFY pay position (right side assumed). */
export function JobRowSkeleton({ last = false }: { last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: GUTTER,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: DIVIDER,
      }}
    >
      <SkeletonNew width={56} height={56} radius={16} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Line width="75%" spec={T.title} />
        <Line width="50%" spec={T.meta} />
      </View>
      <SkeletonNew width={56} height={T.title.lh - 6} radius={6} />
    </View>
  );
}

/** Home > Jobs near you / Popular (vertical rows) */
export function HomeRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <JobRowSkeleton key={i} last={i === count - 1} />
      ))}
    </View>
  );
}

/** JobResultCardNew: photo 112 r16, row gap12 py14 px16, divider 1. Use for Saved. VERIFY body height. */
export function JobResultRowSkeleton({ last = false }: { last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: GUTTER,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: DIVIDER,
      }}
    >
      <SkeletonNew width={112} height={112} radius={16} />
      <View style={{ flex: 1, minWidth: 0, paddingRight: 36 }}>
        <Line width="90%" spec={T.title} />
        <Line width="60%" spec={T.title} />
        <SkeletonNew width={64} height={28} radius={14} style={{ marginVertical: 2 }} />
        <SkeletonNew width={84} height={6} radius={3} style={{ marginVertical: 4 }} />
        <Line width="40%" spec={T.title} />
      </View>
    </View>
  );
}

export function JobResultListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <JobResultRowSkeleton key={i} last={i === count - 1} />
      ))}
    </View>
  );
}

/* =====================================================================
   WORKER: EXPLORE
   ===================================================================== */

/** Explore JobCard: flex 1 r20 p12, logo 40 r16, save 32, title mt12, bottom row mt8. VERIFY section layout. */
export function ExploreJobCardSkeleton() {
  return (
    <View style={{ flex: 1, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: DIVIDER }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonNew width={40} height={40} radius={16} />
        <SkeletonNew width={32} height={32} radius={16} />
      </View>
      <Line width="80%" spec={T.title} style={{ marginTop: 12 }} />
      <Line width="55%" spec={T.meta} />
      <Line width="40%" spec={T.caption} style={{ marginTop: 8 }} />
    </View>
  );
}

/** Two flex cards side by side, px16, gap 12 */
export function ExploreCardRowSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <ExploreJobCardSkeleton />
          <ExploreJobCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/** JobRowGroup: border 1 r16, rows p12 gap12, logo 44 r16, divider 1. VERIFY caption line. */
export function ExploreRowGroupSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ marginHorizontal: GUTTER, borderWidth: 1, borderColor: DIVIDER, borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            gap: 12,
            borderBottomWidth: i === count - 1 ? 0 : 1,
            borderBottomColor: DIVIDER,
          }}
        >
          <SkeletonNew width={44} height={44} radius={16} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Line width="70%" spec={T.body} />
            <Line width="50%" spec={T.meta} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* =====================================================================
   WORKER: LEGACY CARD LISTS (near-you / popular / recommended / category-listing)
   ===================================================================== */

/** components/jobs/JobsUI JobCard: p14 gap12 r20 border1, logo 56 r16, chips mt8 gap6. VERIFY heights. */
export function JobsUiCardSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: DIVIDER,
        backgroundColor: WHITE,
      }}
    >
      <SkeletonNew width={56} height={56} radius={16} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Line width="75%" spec={T.title} />
        <Line width="50%" spec={T.meta} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <SkeletonNew width={56} height={22} radius={11} />
          <SkeletonNew width={72} height={22} radius={11} />
        </View>
      </View>
    </View>
  );
}

export function JobsUiListSkeleton({
  count = 5,
  gap = 12, // VERIFY: real gap between cards on each screen
  style,
}: {
  count?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap, paddingHorizontal: GUTTER }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <JobsUiCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** components/jobs/JobCard variant="row": p10 gap12 r22, thumb 96 r18. For app/category-listing.tsx */
export function LegacyRowCardSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 10,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: DIVIDER,
        backgroundColor: WHITE,
      }}
    >
      <SkeletonNew width={96} height={96} radius={18} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Line width="80%" spec={{ fs: 15, lh: 19 }} />
        <Line width="55%" spec={T.meta} />
        <Line width="35%" spec={T.caption} />
      </View>
    </View>
  );
}

export function LegacyRowListSkeleton({
  count = 5,
  gap = 12, // VERIFY
  style,
}: {
  count?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap, paddingHorizontal: GUTTER }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <LegacyRowCardSkeleton key={i} />
      ))}
    </View>
  );
}

/* =====================================================================
   WORKER: JOB DETAILS, CHAT, PROFILE
   ===================================================================== */

/** JobDetailScreenNew: cover 280, sheet mt-28 r28 pt44 px16, disc 64 r16 b4, facts row, map 128, accordions. */
export function JobDetailSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <SkeletonNew width="100%" height={280} radius={0} />
      <View
        style={{
          marginTop: -28,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: WHITE,
          paddingTop: 44,
          paddingHorizontal: GUTTER,
          paddingBottom: 120,
        }}
      >
        {/* employer disc overlapping the cover. VERIFY offset */}
        <View
          style={{
            position: 'absolute',
            top: -32,
            left: GUTTER,
            width: 64,
            height: 64,
            borderRadius: 16,
            borderWidth: 4,
            borderColor: WHITE,
            overflow: 'hidden',
          }}
        >
          <SkeletonNew width={56} height={56} radius={12} />
        </View>
        <Line width="80%" spec={T.hero} />
        <Line width="50%" spec={T.meta} />

        {/* facts row: 3 blocks, px12 gap2, 1px dividers */}
        <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 12 }}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={{ width: 1, backgroundColor: DIVIDER }} />}
              <View style={{ flex: 1, paddingHorizontal: 12, gap: 2 }}>
                <SkeletonNew width={16} height={16} radius={8} />
                <Line width="60%" spec={T.caption} />
                <Line width="75%" spec={T.title} />
              </View>
            </React.Fragment>
          ))}
        </View>
        <SkeletonNew width={84} height={6} radius={3} />

        {/* location: section title, map 128 r20, location row */}
        <View style={{ marginTop: 24, marginBottom: 12 }}>
          <Line width="35%" spec={T.section} />
        </View>
        <SkeletonNew width="100%" height={128} radius={20} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <SkeletonNew width={44} height={44} radius={22} />
          <View style={{ flex: 1 }}>
            <Line width="65%" spec={T.title} />
            <Line width="40%" spec={T.meta} />
          </View>
        </View>

        {/* accordions: minHeight 52, bottom border 1 */}
        <View style={{ marginTop: 24, marginBottom: 12 }}>
          <Line width="30%" spec={T.section} />
        </View>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: DIVIDER }}
          >
            <Line width="45%" spec={T.title} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** ChatScreenNew message area: bubbles maxWidth 76%, mx16 my4, r20, py10 px14. Header and composer stay real. */
export function ChatThreadSkeleton() {
  const bubbles: { mine: boolean; w: W; h: number }[] = [
    { mine: false, w: '58%', h: 40 },
    { mine: true, w: '46%', h: 40 },
    { mine: false, w: '66%', h: 62 },
    { mine: true, w: '38%', h: 40 },
    { mine: false, w: '52%', h: 40 },
  ];
  return (
    <View style={{ paddingVertical: 16 }}>
      {bubbles.map((b, i) => (
        <View
          key={i}
          style={{
            width: b.w,
            alignSelf: b.mine ? 'flex-end' : 'flex-start',
            marginHorizontal: GUTTER,
            marginVertical: 4,
          }}
        >
          <SkeletonNew width="100%" height={b.h} radius={20} />
        </View>
      ))}
    </View>
  );
}

/** Profile tab: px20, card r28, banner 116, avatar ring 96 mt-48, groups. VERIFY row heights. */
export function ProfileSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
      <View style={{ marginTop: 10, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonNew width={100} height={26} radius={8} />
        <SkeletonNew width={40} height={40} radius={20} />
      </View>
      <View style={{ backgroundColor: WHITE, borderRadius: 28, overflow: 'hidden', paddingBottom: 18, alignItems: 'center' }}>
        <View style={{ alignSelf: 'stretch' }}>
          <SkeletonNew width="100%" height={116} radius={0} />
        </View>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: WHITE,
            padding: 4,
            marginTop: -48,
            marginBottom: 10,
          }}
        >
          <SkeletonNew width={88} height={88} radius={44} />
        </View>
        <SkeletonNew width={150} height={20} radius={6} />
        <SkeletonNew width={110} height={14} radius={6} style={{ marginTop: 6 }} />
        <SkeletonNew width={130} height={13} radius={6} style={{ marginTop: 7 }} />
        <SkeletonNew width={120} height={40} radius={20} style={{ marginTop: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', paddingHorizontal: 20, marginTop: 16 }}>
          <SkeletonNew width={70} height={14} radius={6} />
          <View style={{ flex: 1 }}>
            <SkeletonNew width="100%" height={6} radius={9} />
          </View>
        </View>
      </View>
      {[0, 1, 2].map((g) => (
        <View key={g} style={{ marginTop: 18, backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 20 }}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonNew width={32} height={32} radius={10} />
              <SkeletonNew width="45%" height={14} radius={6} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* =====================================================================
   EMPLOYER
   ===================================================================== */

/** PostDashboard stat card: cardBoxNew r20 mx16 mt16 p16, ring 96, 3 KV rows */
export function DashboardStatCardSkeleton() {
  return (
    <View
      style={[
        cardBoxNew,
        { marginHorizontal: GUTTER, marginTop: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
      ]}
    >
      <SkeletonNew width={96} height={96} radius={48} />
      <View style={{ flex: 1, gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonNew width={90} height={T.meta.fs} radius={6} />
            <SkeletonNew width={28} height={T.title.fs} radius={6} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** PostDashboard job rows: cardBoxNew r20 p10 row gap12 mx16 mt12, image 84 r16 */
export function DashboardJobRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            cardBoxNew,
            { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: GUTTER, marginTop: 12 },
          ]}
        >
          <SkeletonNew width={84} height={84} radius={16} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Line width="35%" spec={T.meta} />
            <Line width="75%" spec={T.title} />
            <SkeletonNew width={64} height={24} radius={12} style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** employer/application/[id]: p20, top bar, identity row (avatar 68), 3 sections */
export function EmployerApplicantSkeleton({ showTopBar = true, padded = true }: { showTopBar?: boolean; padded?: boolean } = {}) {
  return (
    <View style={padded ? { padding: 20, paddingBottom: 35 } : undefined}>
      {showTopBar && (
        <View style={{ marginBottom: 26 }}>
          <SkeletonNew width={92} height={42} radius={12} />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonNew width={68} height={68} radius={34} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <SkeletonNew width="70%" height={22} radius={6} />
          <SkeletonNew width="55%" height={14} radius={6} style={{ marginTop: 8 }} />
          <SkeletonNew width="40%" height={12} radius={6} style={{ marginTop: 6 }} />
        </View>
      </View>
      {[0, 1, 2].map((s) => (
        <View key={s} style={{ borderBottomWidth: 1, borderBottomColor: '#E2E8E5', paddingTop: 23, paddingBottom: 18 }}>
          <SkeletonNew width={100} height={11} radius={5} />
          {[0, 1, 2].map((r) => (
            <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 13 }}>
              <SkeletonNew width={70} height={13} radius={6} />
              <SkeletonNew width={110} height={13} radius={6} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** One applicant ticket in NewJobManager: row gap12, dot 12, card r20 p16 border1 */
export function ApplicantTicketSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, marginBottom: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <SkeletonNew width={12} height={12} radius={6} />
        <View style={{ width: 2, flex: 1, marginTop: 6, backgroundColor: DIVIDER }} />
      </View>
      <View style={{ flex: 1, borderWidth: 1, borderColor: DIVIDER, borderRadius: 20, padding: 16, backgroundColor: WHITE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SkeletonNew width={44} height={44} radius={22} />
          <View style={{ flex: 1 }}>
            <SkeletonNew width="55%" height={15} radius={6} />
            <SkeletonNew width="35%" height={12} radius={6} style={{ marginTop: 6 }} />
          </View>
        </View>
        <SkeletonNew width="100%" height={56} radius={14} style={{ marginVertical: 12 }} />
        <SkeletonNew width="40%" height={13} radius={6} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonNew width={80} height={40} radius={20} />
          <SkeletonNew width={80} height={40} radius={20} />
        </View>
      </View>
    </View>
  );
}

export function ApplicantTicketsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ApplicantTicketSkeleton key={i} />
      ))}
    </View>
  );
}

/** employer/job/[id]: title, stats card, tiles, boost card, location card, tickets. Header stays real. */
export function EmployerJobManagerSkeleton() {
  return (
    <View>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Line width="70%" spec={T.hero} />
        <Line width="55%" spec={T.meta} style={{ marginTop: 4 }} />
      </View>
      <View style={{ margin: GUTTER }}>
        <SkeletonNew width="100%" height={150} radius={20} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: GUTTER }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1 }}>
            <SkeletonNew width="100%" height={84} radius={20} />
          </View>
        ))}
      </View>
      <View style={{ marginHorizontal: GUTTER, marginTop: 12 }}>
        <SkeletonNew width="100%" height={96} radius={20} />
      </View>
      <View style={{ marginHorizontal: GUTTER, marginTop: 12, marginBottom: 24 }}>
        <SkeletonNew width="100%" height={68} radius={16} />
      </View>
      <View style={{ paddingHorizontal: GUTTER, marginBottom: 12 }}>
        <Line width="35%" spec={T.section} />
      </View>
      <ApplicantTicketsSkeleton count={2} />
    </View>
  );
}

/** NewEditJob: fields r16 (single ~64, multi ~108), section titles. VERIFY field heights. */
export function EmployerEditJobSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 24, gap: 12 }}>
      <Line width="40%" spec={T.section} />
      {[64, 64, 112, 64, 64].map((h, i) => (
        <SkeletonNew key={i} width="100%" height={h} radius={16} />
      ))}
      <SkeletonNew width="100%" height={52} radius={14} />
    </View>
  );
}

/** NewEmployerProfile: banner 190+top, avatar 96 r24 mt-56 ml16, name, stat row, about, info lines. */
export function EmployerProfileSkeleton({ topInset = 0 }: { topInset?: number }) {
  return (
    <View>
      <SkeletonNew width="100%" height={190 + topInset} radius={0} />
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          marginTop: -56,
          marginLeft: GUTTER,
          borderWidth: 4,
          borderColor: WHITE,
          overflow: 'hidden',
        }}
      >
        <SkeletonNew width={88} height={88} radius={20} />
      </View>
      <View style={{ paddingHorizontal: GUTTER, marginTop: 12, gap: 6 }}>
        <Line width="55%" spec={T.hero} />
        <Line width="40%" spec={T.body} />
      </View>
      <View style={{ margin: GUTTER, borderRadius: 20, paddingHorizontal: GUTTER, paddingVertical: 14, flexDirection: 'row', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, gap: 6 }}>
            <SkeletonNew width="70%" height={12} radius={6} />
            <SkeletonNew width="50%" height={24} radius={6} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: 6 }}>
        <Line width="100%" spec={T.body} />
        <Line width="92%" spec={T.body} />
        <Line width="70%" spec={T.body} />
      </View>
      <View style={{ marginHorizontal: GUTTER, marginTop: 16 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: DIVIDER }}>
            <SkeletonNew width={20} height={20} radius={10} />
            <SkeletonNew width="30%" height={14} radius={6} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <SkeletonNew width="40%" height={14} radius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
