import type Stripe from 'stripe';
import type { ConnectAccountStatus } from './stripe-provider.js';

type V2Account = Stripe.V2.Core.Account;

function hasBlockingV2Requirements(account: V2Account): boolean {
  const summaryStatus = account.requirements?.summary?.minimum_deadline?.status;
  if (summaryStatus === 'currently_due' || summaryStatus === 'past_due') {
    return true;
  }

  const entries = account.requirements?.entries ?? [];
  return entries.some((entry) => {
    const status = (entry as { status?: string }).status;
    return status === 'currently_due' || status === 'past_due';
  });
}

export function mapV2ConnectAccount(account: V2Account): ConnectAccountStatus {
  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const transfersActive = transfersStatus === 'active';
  const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status;
  const blockingRequirements = hasBlockingV2Requirements(account);
  // Stripe omits requirements.summary when nothing is due — do not treat that as incomplete.
  const onboardingComplete = transfersActive && !blockingRequirements;

  return {
    stripeAccountId: account.id,
    chargesEnabled: transfersActive,
    payoutsEnabled: transfersActive,
    onboardingComplete,
    restricted: requirementsStatus === 'past_due' || blockingRequirements,
  };
}

export function mapV1ConnectAccount(account: Stripe.Account): ConnectAccountStatus {
  return {
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    onboardingComplete: account.details_submitted ?? false,
    restricted: Boolean(account.requirements?.disabled_reason),
  };
}
