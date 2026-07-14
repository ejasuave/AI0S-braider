import { prisma } from '../../lib/db.js';
import { getStripeProvider, isStripeMockMode } from '../../lib/stripe/index.js';
import { MockStripeProvider } from '../../lib/stripe/mock-stripe-provider.js';
import { isStaleMockConnectAccount } from './stripe-compat.js';

export function allowsMockConnectAccount(): boolean {
  return isStripeMockMode() || getStripeProvider() instanceof MockStripeProvider;
}

/** Ch.9.1 — callable by Booking Engine without importing PaymentService. */
export async function isPaymentReady(businessId: string): Promise<boolean> {
  const account = await prisma.paymentAccount.findUnique({
    where: { businessId },
    select: { chargesEnabled: true, stripeConnectAccountId: true },
  });
  if (!account) return false;
  if (!allowsMockConnectAccount() && isStaleMockConnectAccount(account.stripeConnectAccountId)) {
    return false;
  }
  return account.chargesEnabled;
}
