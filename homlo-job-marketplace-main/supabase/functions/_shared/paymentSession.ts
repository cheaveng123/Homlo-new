/**
 * Payment session verification logic.
 *
 * Used by the Supabase edge function (supabase/functions/homlo-service-gateway)
 * to decide whether a payment result should be accepted as "completed".
 *
 * Production safety rules:
 *  - If APP_ENV is unset, it defaults to production and payments fail closed.
 *  - If APP_ENV=production and HOMLO_PAYMENT_VERIFICATION_MODE is "simulated"
 *    (or unset), payments fail closed: verifyPaymentResult() always returns
 *    "failed", so no boost or subscription can be activated.
 *  - Client-supplied simulateResult is only honored when APP_ENV=development
 *    AND mode is "simulated". In every other environment the client cannot
 *    decide the payment result.
 *  - "webhook" mode rejects everything until real provider verification
 *    (signed webhook, idempotency, amount/currency check, ownership check)
 *    is implemented.
 */

const configuredAppEnv = process.env.APP_ENV?.trim();

export const APP_ENV_CONFIGURED = Boolean(configuredAppEnv);
export const APP_ENV = (configuredAppEnv || "production") as string;
export const PAYMENT_VERIFICATION_MODE =
  (process.env.HOMLO_PAYMENT_VERIFICATION_MODE?.trim() || "simulated") as string;

export const IS_PRODUCTION = APP_ENV === "production";
export const IS_DEVELOPMENT = APP_ENV === "development";

if (!APP_ENV_CONFIGURED) {
  console.error(
    "[homlo-service-gateway] FATAL: APP_ENV is not set. Defaulting to production and failing payments closed. " +
      "Set APP_ENV=development only for local development.",
  );
}

// Fail closed: in production, simulated payment verification is not allowed.
if (IS_PRODUCTION && PAYMENT_VERIFICATION_MODE === "simulated") {
  console.error(
    "[homlo-service-gateway] FATAL: HOMLO_PAYMENT_VERIFICATION_MODE=simulated in production. " +
      "Payments are disabled until a live provider (webhook) is configured. " +
      "Set HOMLO_PAYMENT_VERIFICATION_MODE=webhook and configure signed webhook verification.",
  );
}

// Client-supplied simulateResult is only honored in development.
// In every other environment (production, staging, unknown) the client cannot
// decide the payment result.
export function clientMayDecidePayment(): boolean {
  return IS_DEVELOPMENT && PAYMENT_VERIFICATION_MODE === "simulated";
}

export function verifyPaymentResult(payload: Record<string, unknown>): "completed" | "failed" {
  if (PAYMENT_VERIFICATION_MODE === "simulated") {
    if (!clientMayDecidePayment()) {
      // Production/staging/unknown: client cannot decide. Fail closed.
      return "failed";
    }
    return payload.simulateResult === "failed" ? "failed" : "completed";
  }
  if (PAYMENT_VERIFICATION_MODE === "webhook") {
    // Real provider verification (signed webhook, idempotency, amount/currency
    // check, ownership check) is not implemented yet. Webhook mode rejects
    // everything until it is.
    return "failed";
  }
  // Unknown or unset mode: fail closed — client cannot decide payment result.
  return "failed";
}
