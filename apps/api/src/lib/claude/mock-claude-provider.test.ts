import { describe, expect, it } from 'vitest';
import { MockClaudeProvider } from './mock-claude-provider.js';

describe('MockClaudeProvider dev defaults', () => {
  it('replies with high confidence for general messages outside test mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const mock = new MockClaudeProvider();
    const result = await mock.completeStructuredTurn({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'Hi there' }],
    });

    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.next_action).not.toBe('escalate');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('detects booking intent and style names in development', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const mock = new MockClaudeProvider();
    const result = await mock.completeStructuredTurn({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'Can I book box braids next week?' }],
    });

    expect(result.intent).toBe('new_booking');
    expect(result.extracted_slots.styleName).toBe('Box braids');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('escalates unhandled messages in test mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const mock = new MockClaudeProvider();
    const result = await mock.completeStructuredTurn({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'Unhandled scenario' }],
    });

    expect(result.next_action).toBe('escalate');
    expect(result.confidence).toBeLessThan(0.8);

    process.env.NODE_ENV = originalNodeEnv;
  });
});
