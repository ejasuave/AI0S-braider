import { describe, expect, it } from 'vitest';
import { parseChatDepositPayload } from './chat-deposit-card';

describe('parseChatDepositPayload', () => {
  it('reads deposit metadata from send_deposit_link structured output', () => {
    expect(
      parseChatDepositPayload({
        next_action: 'send_deposit_link',
        booking_id: '11111111-1111-4111-8111-111111111111',
        payment_id: '22222222-2222-4222-8222-222222222222',
        deposit_amount: '20.00',
      }),
    ).toEqual({
      bookingId: '11111111-1111-4111-8111-111111111111',
      paymentId: '22222222-2222-4222-8222-222222222222',
      amount: '20.00',
    });
  });

  it('ignores messages without deposit signals', () => {
    expect(
      parseChatDepositPayload({
        next_action: 'answer_faq',
        booking_id: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBeNull();
  });
});
