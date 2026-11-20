// lib/age.ts
// Shared limits for the age a person gives after signing up. The same range is
// enforced by the tRPC input schema and by the database (055_user_age.sql).

export const AGE_MIN = 16;
export const AGE_MAX = 80;
export const AGE_DEFAULT = 24;

export function clampAge(value: number): number {
  return Math.min(AGE_MAX, Math.max(AGE_MIN, Math.round(value)));
}
