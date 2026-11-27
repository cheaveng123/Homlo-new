/**
 * Cookie consent for the web build.
 *
 * Today the app sets NO analytics or marketing cookies; it only uses
 * strictly necessary storage (sign-in session, preferences). Anything
 * non-essential added later MUST be loaded through `whenConsented`, so it
 * only runs after the visitor clicks "Accept":
 *
 *   whenConsented("analytics", () => loadMyAnalyticsScript());
 *
 * The choice is kept in localStorage on this device (not in consent_log:
 * anonymous visitors have no account).
 */
export type CookieCategory = "analytics" | "marketing";
export type CookieChoice = { analytics: boolean; marketing: boolean; decidedAt: string };

const KEY = "homlo.cookieConsent.v1";
const waiting: { category: CookieCategory; run: () => void }[] = [];

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getCookieChoice(): CookieChoice | null {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as CookieChoice) : null;
  } catch {
    return null;
  }
}

export function setCookieChoice(choice: { analytics: boolean; marketing: boolean }) {
  const value: CookieChoice = { ...choice, decidedAt: new Date().toISOString() };
  try {
    storage()?.setItem(KEY, JSON.stringify(value));
  } catch {
    // private mode: the banner simply shows again next visit
  }
  for (let i = waiting.length - 1; i >= 0; i -= 1) {
    if (value[waiting[i].category]) {
      waiting[i].run();
      waiting.splice(i, 1);
    }
  }
}

/** Runs `run` now if the visitor allowed `category`, or later when they do. Never runs otherwise. */
export function whenConsented(category: CookieCategory, run: () => void) {
  if (getCookieChoice()?.[category]) run();
  else waiting.push({ category, run });
}
