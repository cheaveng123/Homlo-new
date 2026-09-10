import { describe, expect, it } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import type { PaymentProviderAdapter } from "../backend/infrastructure/payments/PaymentProviderAdapter";
import { PaymentService } from "../backend/services/PaymentService";

const employerId = "11111111-1111-4111-8111-111111111111";
const jobId = "33333333-3333-4333-8333-333333333333";

class InMemoryPaymentDatabase implements DatabaseAdapter {
  private webhookRecorded = false;
  public boostsCreated = 0;
  private readonly now = new Date("2026-08-27T00:00:00.000Z");

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, _parameters: readonly SqlParameter[] = []): Promise<QueryResult<Row>> {
    let rows: Record<string, unknown>[] = [];
    if (statement.startsWith("insert into payment_webhook_events")) {
      if (!this.webhookRecorded) { this.webhookRecorded = true; rows = [{ id: "event", provider: "example", provider_event_id: "evt-1", event_type: "payment.completed", payload: {}, received_at: this.now, processed_at: null }]; }
    } else if (statement.startsWith("update payments set status = 'completed'")) {
      rows = [{ id: "payment", user_id: employerId, job_id: jobId, boost_id: null, amount: 12, currency: "USD", provider: "example", provider_transaction_id: "tx-1", status: "completed", created_at: this.now, updated_at: this.now }];
    } else if (statement.startsWith("select * from jobs")) {
      rows = [{ id: jobId, employer_id: employerId, category_id: null, title: "Server", description: "Serve guests", pay_amount: 10, pay_currency: "USD", pay_type: "hourly", location_text: null, latitude: null, longitude: null, start_date: null, end_date: null, start_time: null, end_time: null, workers_needed: 1, workers_hired: 0, status: "open", created_at: this.now, updated_at: this.now, deleted_at: null }];
    } else if (statement.startsWith("insert into boosts")) {
      this.boostsCreated += 1;
      rows = [{ id: "boost", job_id: jobId, employer_id: employerId, package: "verified_checkout", start_at: this.now, expires_at: this.now, status: "active", created_at: this.now, updated_at: this.now }];
    } else if (statement.startsWith("insert into audit_logs")) {
      rows = [{ id: "audit", actor_user_id: null, action: "event", entity_type: "event", entity_id: null, metadata: null, created_at: this.now }];
    }
    return { rows: rows as Row[], rowCount: rows.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> { return work(this); }
}

const provider: PaymentProviderAdapter = {
  async createCheckout() { return { providerTransactionId: "tx-1", checkoutUrl: "https://payments.example/checkout" }; },
  async verifyWebhookSignature() { return true; },
  parseVerifiedWebhook() { return { providerEventId: "evt-1", eventType: "payment.completed", providerTransactionId: "tx-1", completed: true }; },
};

describe("PaymentService webhook handling", () => {
  it("records the provider event before activation so a duplicate cannot create another Boost", async () => {
    const database = new InMemoryPaymentDatabase();
    const service = new PaymentService(database, { example: provider });

    const first = await service.handleWebhook("example", "{}", {});
    const duplicate = await service.handleWebhook("example", "{}", {});

    expect(first.duplicate).toBe(false);
    expect(first.boost?.id).toBe("boost");
    expect(duplicate).toEqual({ duplicate: true, payment: null, boost: null });
    expect(database.boostsCreated).toBe(1);
  });
});
