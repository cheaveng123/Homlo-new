import type { Boost, Payment, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import type { PaymentProviderAdapter } from "../infrastructure/payments/PaymentProviderAdapter";
import { PostgresBoostRepository, PostgresPaymentRepository, PostgresPaymentWebhookEventRepository } from "../repositories/PaymentsRepository";
import { PostgresJobRepository } from "../repositories/JobRepository";
import { AuditLogService } from "./ReportAuditService";

export class PaymentService {
  constructor(private readonly database: DatabaseAdapter, private readonly providers: Record<string, PaymentProviderAdapter>) {}
  async createBoostCheckout(userId: UUID, jobId: UUID, amount: number, packageName: string, providerName: string): Promise<{ payment: Payment; checkoutUrl: string }> {
    const provider = this.providers[providerName]; if (!provider) throw new Error("Unsupported payment provider");
    const job = await new PostgresJobRepository(this.database).findById(jobId);
    if (!job || job.employerId !== userId) throw new Error("Only the listing employer can purchase a Boost");
    const payment = await new PostgresPaymentRepository(this.database).create(userId, amount, "USD", providerName, jobId);
    const checkout = await provider.createCheckout(amount, "USD", { paymentId: payment.id, jobId, package: packageName });
    const attached = await new PostgresPaymentRepository(this.database).attachProviderTransaction(payment.id, checkout.providerTransactionId);
    return { payment: attached, checkoutUrl: checkout.checkoutUrl };
  }
  async handleWebhook(providerName: string, rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<{ duplicate: boolean; payment: Payment | null; boost: Boost | null }> {
    const provider = this.providers[providerName]; if (!provider) throw new Error("Unsupported payment provider");
    if (!(await provider.verifyWebhookSignature(rawBody, headers))) throw new Error("Invalid payment webhook signature");
    const event = provider.parseVerifiedWebhook(rawBody);
    return this.database.transaction(async (transaction) => {
      const events = new PostgresPaymentWebhookEventRepository(transaction);
      const received = await events.recordIfNew(providerName, event.providerEventId, event.eventType, JSON.parse(rawBody) as Record<string, unknown>);
      if (!received) return { duplicate: true, payment: null, boost: null };
      const payments = new PostgresPaymentRepository(transaction);
      const payment = event.completed ? await payments.markCompleted(event.providerTransactionId) : await payments.markFailed(event.providerTransactionId);
      let boost: Boost | null = null;
      if (payment?.status === "completed" && payment.jobId) {
        const job = await new PostgresJobRepository(transaction).findById(payment.jobId);
        if (!job) throw new Error("Payment references a missing job");
        const startAt = new Date(); const expiresAt = new Date(startAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        boost = await new PostgresBoostRepository(transaction).create(job.id, job.employerId, "verified_checkout", startAt, expiresAt);
        await new AuditLogService(transaction).record(null, "payment.completed", "payment", payment.id, { provider: providerName, amount: payment.amount });
        await new AuditLogService(transaction).record(null, "boost.activated", "boost", boost.id, {});
      }
      await events.markProcessed(received.id);
      return { duplicate: false, payment, boost };
    });
  }
}
