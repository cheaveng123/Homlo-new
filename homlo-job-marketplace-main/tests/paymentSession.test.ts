import { describe, expect, it, vi, afterEach } from "vitest";

const origEnv = process.env.APP_ENV;
const origMode = process.env.HOMLO_PAYMENT_VERIFICATION_MODE;

async function setEnv(appEnv: string, mode: string) {
  vi.resetModules();
  process.env.APP_ENV = appEnv;
  process.env.HOMLO_PAYMENT_VERIFICATION_MODE = mode;
  return await import("../lib/paymentSession");
}

function resetEnv() {
  if (origEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = origEnv;
  if (origMode === undefined) delete process.env.HOMLO_PAYMENT_VERIFICATION_MODE;
  else process.env.HOMLO_PAYMENT_VERIFICATION_MODE = origMode;
  vi.resetModules();
}

describe("paymentSession - production fail-closed", () => {
  afterEach(resetEnv);

  it("simulated mode in production: verifyPaymentResult returns 'failed' even with simulateResult=completed", async () => {
    const mod = await setEnv("production", "simulated");
    expect(mod.IS_PRODUCTION).toBe(true);
    expect(mod.IS_DEVELOPMENT).toBe(false);
    expect(mod.clientMayDecidePayment()).toBe(false);
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
    expect(mod.verifyPaymentResult({})).toBe("failed");
  });

  it("unset mode in production: verifyPaymentResult returns 'failed'", async () => {
    const mod = await setEnv("production", "");
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
    expect(mod.verifyPaymentResult({ provider: "aba_payway", providerEventId: "evt-1" })).toBe("failed");
  });

  it("webhook mode in production: verifyPaymentResult returns 'failed' (real verification not implemented)", async () => {
    const mod = await setEnv("production", "webhook");
    expect(mod.verifyPaymentResult({ provider: "aba_payway", providerEventId: "evt-1" })).toBe("failed");
    expect(mod.verifyPaymentResult({})).toBe("failed");
  });

  it("startup warning logged when production + simulated", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mod = await setEnv("production", "simulated");
    expect(mod.IS_PRODUCTION).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("FATAL: HOMLO_PAYMENT_VERIFICATION_MODE=simulated in production"),
    );
    errorSpy.mockRestore();
  });
});

describe("paymentSession - client simulateResult ignored outside development", () => {
  afterEach(resetEnv);

  it("staging + simulated: simulateResult=completed is ignored, returns 'failed'", async () => {
    const mod = await setEnv("staging", "simulated");
    expect(mod.clientMayDecidePayment()).toBe(false);
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
    expect(mod.verifyPaymentResult({ simulateResult: "failed" })).toBe("failed");
  });

  it("unknown env + simulated: simulateResult=completed is ignored, returns 'failed'", async () => {
    const mod = await setEnv("unknown", "simulated");
    expect(mod.clientMayDecidePayment()).toBe(false);
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
  });

  it("production + webhook: simulateResult=completed is ignored, returns 'failed'", async () => {
    const mod = await setEnv("production", "webhook");
    expect(mod.clientMayDecidePayment()).toBe(false);
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
  });
});

describe("paymentSession - development still works", () => {
  afterEach(resetEnv);

  it("development + simulated: simulateResult=completed returns 'completed'", async () => {
    const mod = await setEnv("development", "simulated");
    expect(mod.IS_DEVELOPMENT).toBe(true);
    expect(mod.clientMayDecidePayment()).toBe(true);
    expect(mod.verifyPaymentResult({ simulateResult: "completed" })).toBe("completed");
    expect(mod.verifyPaymentResult({ simulateResult: "failed" })).toBe("failed");
  });

  it("development + simulated: no simulateResult defaults to 'completed'", async () => {
    const mod = await setEnv("development", "simulated");
    expect(mod.verifyPaymentResult({})).toBe("completed");
  });

  it("development + webhook: webhook mode returns 'failed' (not implemented)", async () => {
    const mod = await setEnv("development", "webhook");
    expect(mod.verifyPaymentResult({ provider: "aba_payway", providerEventId: "evt-1" })).toBe("failed");
  });
});
