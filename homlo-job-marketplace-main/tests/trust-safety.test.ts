import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { decryptField, encryptField, hashIdentifier } from "../server/trust/crypto";
import { CONSENT_WORDING } from "../lib/legal/consent-wording";
import { PRIVACY, TERMS } from "../lib/legal/legal-docs.generated";
import { setCookieChoice, whenConsented } from "../lib/cookie-consent";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

describe("field encryption and identifier hashing", () => {
  it("round-trips encrypted values and refuses tampered ones", () => {
    const stored = encryptField("203.0.113.7");
    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain("203.0.113.7");
    expect(decryptField(stored)).toBe("203.0.113.7");
    const tampered = stored!.slice(0, -4) + (stored!.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(decryptField(tampered)).toBeNull();
    expect(encryptField("")).toBeNull();
  });

  it("hashes emails case-insensitively and keeps kinds apart", () => {
    expect(hashIdentifier("email", " Person@Example.com ")).toBe(hashIdentifier("email", "person@example.com"));
    expect(hashIdentifier("phone", "+855 12 345 678")).toBe(hashIdentifier("phone", "+85512345678"));
    expect(hashIdentifier("device", "abc")).not.toBe(hashIdentifier("ip", "abc"));
  });
});

describe("legal wording is the owner's text, unchanged", () => {
  it("uses the Part 3 checkbox wording verbatim", () => {
    expect(CONSENT_WORDING.signup).toBe(
      "I confirm that I am 18 years old or older and legally able to enter into this agreement. I have read and agree to the [Terms of Service] and [Privacy Policy].",
    );
    expect(CONSENT_WORDING.jobPosting).toBe(
      "I confirm that I am 18 or older and authorized to hire. This job is real and accurately described, is legal in the place where the work will be done, does not charge applicants any fee, and does not discriminate unlawfully.",
    );
    expect(CONSENT_WORDING.purchase).toBe(
      "I agree to the payment terms, including that boosts and subscription periods are non-refundable once started, and that subscriptions renew automatically until cancelled.",
    );
    expect(CONSENT_WORDING.marketing).toBe("Send me job alerts and updates by email. You can unsubscribe at any time.");
  });

  it("keeps the bundled pages in sync with legal/*.md (run scripts/build-legal-content.mjs)", () => {
    for (const [doc, file] of [[TERMS, "legal/terms.md"], [PRIVACY, "legal/privacy.md"]] as const) {
      const md = read(file);
      expect(md.split(/\n---\n/)[1].trim()).toBe(doc.body);
      expect(doc.version).toBe("1.0");
      expect(doc.effectiveDate).toBe("[DATE]");
    }
  });

  it("leaves the owner's placeholders in place", () => {
    for (const placeholder of ["[COMPANY NAME]", "[COUNTRY/STATE]", "[LEGAL EMAIL]", "[SUPPORT EMAIL]", "[USD 100]"]) {
      expect(TERMS.body).toContain(placeholder);
    }
    for (const placeholder of ["[PRIVACY EMAIL]", "[PROVIDER NAME]", "[2 to 5]", "[NAME/CONTACT]"]) {
      expect(PRIVACY.body).toContain(placeholder);
    }
  });
});

describe("consent checkboxes start unticked", () => {
  it.each([
    ["app/login.tsx", /const \[acceptTerms, setAcceptTerms\] = useState\(false\)/],
    ["app/login.tsx", /const \[marketingOptIn, setMarketingOptIn\] = useState\(false\)/],
    ["app/boost/payment.tsx", /const \[termsAccepted, setTermsAccepted\] = useState\(false\)/],
    ["app/checkout.tsx", /const \[termsAccepted, setTermsAccepted\] = useState\(false\)/],
    ["components/legal/PublishDeclarationSheet.tsx", /const \[agreed, setAgreed\] = useState\(false\)/],
  ])("%s", (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });

  it("the boost checkout no longer collects card numbers", () => {
    const source = read("app/boost/payment.tsx");
    expect(source).not.toMatch(/Card number|placeholder="MM \/ YY"|label="CVC"/);
  });
});

describe("database enforcement (057_trust_safety.sql)", () => {
  const sql = read("backend/database/migrations/057_trust_safety.sql");

  it("is mirrored unchanged into supabase/migrations", () => {
    expect(read("supabase/migrations/20261120120000_trust_safety.sql")).toBe(sql);
  });

  it("makes consent_log and moderation_actions append-only", () => {
    expect(sql).toContain("raise exception 'consent_log is append-only'");
    expect(sql).toContain("revoke update, delete, truncate on consent_log");
    expect(sql).toContain("raise exception 'moderation_actions is append-only'");
    expect(sql).toMatch(/create trigger trg_consent_log_guard\s+before update or delete on consent_log/);
  });

  it("gates every listing write and every new checkout with triggers", () => {
    expect(sql).toMatch(/create trigger trg_jobs_trust_safety_gate\s+before insert or update on jobs/);
    expect(sql).toMatch(/create trigger trg_payments_guard before insert on payments/);
    expect(sql).toMatch(/create trigger trg_rc_purchases_guard before insert on revenuecat_boost_purchases/);
    for (const rule of ["Confirm your email address before posting", "Verify your phone number before posting", "Confirm the job posting declaration", "New accounts can post up to"]) {
      expect(sql).toContain(rule);
    }
  });

  it("keeps every limit configurable", () => {
    for (const key of ["new_account_max_listings", "listing_expiry_days", "new_account_spend_cap_cents", "closed_account_purge_days", "inactive_account_months"]) {
      expect(sql).toContain(`'${key}'`);
    }
  });
});

describe("cookie consent", () => {
  it("only runs analytics after the visitor accepts", () => {
    const load = vi.fn();
    whenConsented("analytics", load);
    expect(load).not.toHaveBeenCalled();
    setCookieChoice({ analytics: false, marketing: false });
    expect(load).not.toHaveBeenCalled();
    setCookieChoice({ analytics: true, marketing: false });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
