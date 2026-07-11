import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { toPence } from './mappers.js';

describe('payment mappers', () => {
  it('converts GBP decimal amounts to pence', () => {
    expect(toPence(new Decimal('37.50'))).toBe(3750);
    expect(toPence(10)).toBe(1000);
    expect(toPence(new Decimal('0.01'))).toBe(1);
  });
});
