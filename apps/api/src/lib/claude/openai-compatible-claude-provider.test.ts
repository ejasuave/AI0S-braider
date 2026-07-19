import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleClaudeProvider } from './openai-compatible-claude-provider.js';

describe('OpenAICompatibleClaudeProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses tool-call structured output from OpenAI-compatible APIs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: 'receptionist_turn',
                    arguments: JSON.stringify({
                      intent: 'new_booking',
                      extracted_slots: { styleName: '' },
                      confidence: 0.91,
                      next_action: 'ask_clarification',
                      client_message: 'What style are you looking for?',
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAICompatibleClaudeProvider(
      'test-key',
      'https://api.groq.com/openai/v1',
      'llama-3.3-70b-versatile',
    );

    const result = await provider.completeStructuredTurn({
      systemPrompt: 'You are a receptionist.',
      messages: [{ role: 'user', content: 'CLIENT: Hi I want to book' }],
    });

    expect(result.intent).toBe('new_booking');
    expect(result.client_message).toMatch(/style/i);
    expect(result.extracted_slots).toEqual({});
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('surfaces provider HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'credit balance is too low' } }),
      }),
    );

    const provider = new OpenAICompatibleClaudeProvider(
      'test-key',
      'https://api.groq.com/openai/v1',
      'llama-3.3-70b-versatile',
    );

    await expect(
      provider.completeStructuredTurn({
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(/AI provider request failed/i);
  });
});
