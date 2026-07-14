import { isStripeMockMode } from '../../lib/stripe/index.js';

/** Pending payments created under mock Stripe before live keys were configured. */
export function isStaleMockPaymentIntent(stripePaymentIntentId: string): boolean {
  return (
    !isStripeMockMode() &&
    (stripePaymentIntentId.startsWith('pi_mock_') || stripePaymentIntentId.includes('_mock_'))
  );
}

export function isStaleMockConnectAccount(stripeConnectAccountId: string): boolean {
  return !isStripeMockMode() && stripeConnectAccountId.startsWith('acct_mock_');
}

/** Retry onboarding with a fresh Express account only when the stored account id is unusable. */
export function isRecoverableConnectAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('no such account') ||
    normalized.includes('does not have access to account') ||
    normalized.includes('invalid account')
  );
}
