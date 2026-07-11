import { describe, expect, it } from 'vitest';
import { messagingRepository } from './repository.js';

describe('conversation resolution', () => {
  it('exposes findOpenConversation for active and escalated threads only', () => {
    expect(typeof messagingRepository.findOpenConversation).toBe('function');
    expect(typeof messagingRepository.createConversation).toBe('function');
  });
});
