export type PaymentCheckout = {
  providerTransactionId: string;
  checkoutUrl: string;
};

export type VerifiedPaymentWebhook = {
  providerEventId: string;
  eventType: string;
  providerTransactionId: string;
  completed: boolean;
};

export interface PaymentProviderAdapter {
  createCheckout(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<PaymentCheckout>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<boolean>;
  parseVerifiedWebhook(rawBody: string): VerifiedPaymentWebhook;
}
