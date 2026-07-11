import { describe, expect, it } from 'vitest';
import { MIN_TOUCH_TARGET_PX, TOUCH_LINK_CLASS, TOUCH_TARGET_CLASS } from './touch-target';

describe('touch-target', () => {
  it('documents the 44px minimum from visual-identity-and-ux.md', () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(44);
  });

  it('uses min-h-11 (44px) as the Tailwind touch-target class', () => {
    expect(TOUCH_TARGET_CLASS).toBe('min-h-11');
  });

  it('styles inline links for reliable mobile tap targets', () => {
    expect(TOUCH_LINK_CLASS).toContain('min-h-11');
    expect(TOUCH_LINK_CLASS).toContain('inline-flex');
  });
});
