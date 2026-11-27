// lib/display-name.ts
// The name a new profile starts with when the person was never asked for one
// (profile setup is now a single optional photo step). Uses the name they gave
// at sign-up if any, otherwise a tidy version of their email's local part.
// People can change it later from their profile.

const FALLBACK = "Homlo member";

export function defaultDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  const given = name?.trim();
  if (given && given.length >= 2) return given.slice(0, 120);

  const local = email?.split("@")[0] ?? "";
  const words = local
    .replace(/\+.*$/, "") // drop "+tag" aliases
    .split(/[._\-\s]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0 && !/^\d+$/.test(w));
  const pretty = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return pretty.length >= 2 ? pretty.slice(0, 120) : FALLBACK;
}
