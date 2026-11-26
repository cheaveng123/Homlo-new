import React from 'react';
import { View, Text, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { colors, radii, type } from './theme';

export type JobCardVariant = 'featured' | 'twoCol' | 'standard' | 'ticket' | 'large' | 'small';

export interface JobCardData {
  title: string;
  salary: string;
  location: string;
  tone?: 1 | 2 | 3 | 4 | 5; // placeholder palette until real photos are wired up
  imageSource?: ImageSourcePropType;
}

// Sizing per variant. `width` is only set where the card sits in a
// horizontally-scrolling row (RN can't size a scroll child with flex alone);
// everywhere else aspectRatio + the parent's flex layout does the job,
// same as the aspect-ratio + flexbox the mockup used.
const VARIANT: Record<JobCardVariant, { aspectRatio?: number; borderRadius: number; width?: number }> = {
  featured: { aspectRatio: 1.55, borderRadius: radii.featured },
  twoCol: { aspectRatio: 0.92, borderRadius: radii.twoCol },
  standard: { aspectRatio: 0.82, borderRadius: radii.standard, width: 168 },
  ticket: { borderRadius: radii.ticket, width: 220 },
  large: { aspectRatio: 0.86, borderRadius: radii.large },
  small: { aspectRatio: 1, borderRadius: radii.small },
};

function Photo({ job }: { job: JobCardData }) {
  return job.imageSource ? (
    <Image source={job.imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
  ) : (
    <PhotoPlaceholder tone={job.tone ?? 1} />
  );
}

export function JobCard({ variant, job }: { variant: JobCardVariant; job: JobCardData }) {
  const v = VARIANT[variant];

  // Ticket variant: 16:9 image on top, info sits below in a plain white
  // body — never overlaid — per the spec's "used sparingly" ticket shape.
  if (variant === 'ticket') {
    return (
      <View style={[styles.ticketCard, { width: v.width, borderRadius: v.borderRadius }]}>
        <View style={styles.ticketImage}>
          <Photo job={job} />
        </View>
        <View style={styles.ticketBody}>
          <Text style={type.jobTitleLight} numberOfLines={2}>{job.title}</Text>
          <View style={styles.metaRow}>
            <Text style={type.salaryLight}>{job.salary}</Text>
            <Text style={type.locationLight} numberOfLines={1}>{job.location}</Text>
          </View>
        </View>
      </View>
    );
  }

  // Every other variant: full-bleed photo with a blurred overlay near the
  // bottom carrying title / salary / location — never a heavily darkened image.
  return (
    <View
      style={[
        styles.imageCard,
        { borderRadius: v.borderRadius, aspectRatio: v.aspectRatio, width: v.width },
      ]}
    >
      <Photo job={job} />
      <BlurView blurAmount={13} blurType="dark" style={[styles.overlay, { borderRadius: radii.overlay }]}>
        <Text style={type.jobTitle} numberOfLines={2}>{job.title}</Text>
        <View style={styles.metaRow}>
          <Text style={type.salary}>{job.salary}</Text>
          <Text style={type.location} numberOfLines={1}>{job.location}</Text>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  imageCard: { overflow: 'hidden', backgroundColor: colors.line },
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: 'hidden',
    backgroundColor: colors.overlayScrim, // shows if BlurView tint is unsupported on a device
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    gap: 8,
  },
  ticketCard: {
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ticketImage: { aspectRatio: 16 / 9, overflow: 'hidden' },
  ticketBody: { paddingHorizontal: 12, paddingVertical: 10 },
});
