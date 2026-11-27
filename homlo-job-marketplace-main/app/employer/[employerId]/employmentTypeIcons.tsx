// employmentTypeIcons.tsx
//
// Single source of truth for which icon represents each employment type.
// Both the Employer Profile preview list and the All Jobs category bar /
// job cards import from here so the iconography never drifts between screens.

import React from 'react';
import { AppIcon, type IconName } from "@/components/ui/AppIcon";
import type { EmploymentType } from './types';

export const EMPLOYMENT_TYPE_ICON: Record<EmploymentType, IconName> = {
  'full-time': 'brief',
  'part-time': 'clock',
  weekends: 'calendar',
  remote: 'home',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  weekends: 'Weekends',
  remote: 'Remote',
};

/** Category bar tab identifier: 'all' plus every EmploymentType */
export type CategoryFilter = 'all' | EmploymentType;

export const CATEGORY_ORDER: CategoryFilter[] = ['all', 'full-time', 'part-time', 'weekends', 'remote'];

export function getCategoryIcon(category: CategoryFilter): IconName {
  if (category === 'all') return 'grid';
  return EMPLOYMENT_TYPE_ICON[category];
}

export function getCategoryLabel(category: CategoryFilter): string {
  if (category === 'all') return 'All';
  return EMPLOYMENT_TYPE_LABEL[category];
}

export default function EmploymentTypeIcons() {
  return null;
}

export function EmploymentTypeIcon({
  type,
  size = 16,
  color = '#222222',
}: {
  type: EmploymentType;
  size?: number;
  color?: string;
}) {
  return <AppIcon name={EMPLOYMENT_TYPE_ICON[type]} size={size} color={color} />;
}