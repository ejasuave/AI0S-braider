import { onBookingDepositDisposition } from '../../lib/domain-events.js';
import { paymentService } from './service.js';

/** Ch.9.3 — subscribe to booking cancellation/no-show outcomes without cross-module imports. */
onBookingDepositDisposition(async ({ bookingId, depositDisposition }) => {
  if (depositDisposition === 'no_action') {
    return;
  }
  if (depositDisposition === 'full_refund') {
    await paymentService.processRefund(bookingId, 'full');
    return;
  }
  if (depositDisposition === 'forfeit_deposit') {
    await paymentService.processRefund(bookingId, 'none');
  }
});
