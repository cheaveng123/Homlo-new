import { describe, expect, it } from "vitest";
import { shouldInvalidatePublicCaches } from "@/server/_core/write-invalidation";

describe("shouldInvalidatePublicCaches", () => {
  it("keeps public caches for writes that cannot change a listing", () => {
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.messaging.send")).toBe(false);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.notifications.markRead")).toBe(false);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.profile.uploadPhoto")).toBe(false);
    expect(shouldInvalidatePublicCaches("/api/trpc/trust.consent.accept")).toBe(false);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.messaging.send,homlo.notifications.markRead")).toBe(false);
    expect(shouldInvalidatePublicCaches("/api/applications/precheck")).toBe(false);
  });

  it("clears public caches for job-affecting writes", () => {
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.employer.saveJob")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.applications.submit")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.boost.verifyPayment")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/trpc/trust.admin.suspendJob")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/trpc/homlo.messaging.send,homlo.employer.deleteJob")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/webhooks/revenuecat")).toBe(true);
    expect(shouldInvalidatePublicCaches("/api/boosts")).toBe(true);
  });
});
