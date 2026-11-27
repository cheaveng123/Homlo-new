import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { AppIcon } from "@/components/ui/AppIcon";

export type ListingStatus = 'live' | 'draft' | 'review';

export type EmployerListing = {
  id: string;
  title: string;
  employmentType: string;
  salaryLabel: string; // e.g. "$650/mo" or "not set"
  status: ListingStatus;
  imageUrl?: string;
  applicantsCount?: number;
  newApplicantsCount?: number;
  lastEditedLabel?: string; // drafts: "Edited 2 days ago"
  reviewNoteLabel?: string; // review: "Submitted 1 day ago"
  closedDateLabel?: string; // legacy closed listings, if you keep the state
};

const STATUS_DOT: Record<ListingStatus, string> = {
  live: '#0891B2',
  draft: '#E0A800',
  review: '#8BD3E3',
};

type Props = {
  listing: EmployerListing;
  onPress: (id: string) => void;
  onMenuPress: (id: string) => void;
};

export function EmployerJobListingCard({ listing, onPress, onMenuPress }: Props) {
  const dotColor = STATUS_DOT[listing.status];

  const subLabel =
    listing.status === 'draft'
      ? listing.lastEditedLabel
      : listing.status === 'review'
      ? listing.reviewNoteLabel
      : listing.applicantsCount != null
      ? `${listing.applicantsCount} applicants${
          listing.newApplicantsCount ? ` · ${listing.newApplicantsCount} new` : ''
        }`
      : undefined;

  return (
    <Pressable style={styles.card} onPress={() => onPress(listing.id)}>
      {listing.imageUrl ? (
        <Image source={{ uri: listing.imageUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <AppIcon name="image-off" size={20} color="#9AAAB1" />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.title} numberOfLines={1}>
            {listing.title}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {listing.employmentType} · {listing.salaryLabel}
        </Text>
        {subLabel ? (
          <Text style={styles.subLabel} numberOfLines={1}>
            {subLabel}
          </Text>
        ) : null}
      </View>

      <Pressable hitSlop={10} onPress={() => onMenuPress(listing.id)} style={styles.menuBtn}>
        <AppIcon name="dots" size={18} color="#9AAAB1" />
      </Pressable>
    </Pressable>
  );
}

// Fixed pixel values are intentional — they match the approved mockup exactly.
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#EEF3F4',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  title: { fontSize: 14, fontWeight: '500', color: '#14324A' },
  meta: { fontSize: 12, color: '#5D7480', marginTop: 2, marginBottom: 6 },
  subLabel: { fontSize: 12, color: '#14324A' },
  menuBtn: { padding: 4 },
});