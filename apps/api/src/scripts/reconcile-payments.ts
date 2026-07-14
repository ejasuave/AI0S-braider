#!/usr/bin/env tsx
/**
 * Ch.9.4 — manual reconciliation script comparing local payments rows to Stripe.
 * Usage: pnpm --filter @project-braids/api exec tsx src/scripts/reconcile-payments.ts
 */
import { paymentService } from '../modules/payments/service.js';

async function main(): Promise<void> {
  const mismatches = await paymentService.reconcileRecentPayments(50);
  if (mismatches.length === 0) {
    console.log('No payment status mismatches found.');
    return;
  }

  console.log(`Found ${mismatches.length} mismatch(es):`);
  for (const row of mismatches) {
    console.log(
      `- payment ${row.paymentId} booking ${row.bookingId}: local=${row.localStatus} stripe=${row.stripeStatus}`,
    );
  }
  process.exitCode = 1;
}

void main();
