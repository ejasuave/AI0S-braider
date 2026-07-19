import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../errors.js';
import type { ClaudeCompletionRequest, ClaudeProvider } from './claude-provider.types.js';
import {
  RECEPTIONIST_TOOL_NAME,
  RECEPTIONIST_TOOL_PARAMETERS,
} from './receptionist-tool-schema.js';

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
      content?: string | null;
    };
  }>;
  error?: { message?: string };
};

export class OpenAICompatibleClaudeProvider implements ClaudeProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async completeStructuredTurn(request: ClaudeCompletionRequest): Promise<ReceptionistTurnOutput> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: RECEPTIONIST_TOOL_NAME,
              description: 'Return the structured receptionist turn for this conversation.',
              parameters: RECEPTIONIST_TOOL_PARAMETERS,
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: RECEPTIONIST_TOOL_NAME },
        },
      }),
    });

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      throw ApiError.serviceUnavailable(`AI provider request failed: ${detail}`);
    }

    const toolCall = payload.choices?.[0]?.message?.tool_calls?.find(
      (call) => call.function?.name === RECEPTIONIST_TOOL_NAME,
    );
    if (!toolCall?.function?.arguments) {
      throw ApiError.internal('AI provider did not return a structured receptionist turn');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(toolCall.function.arguments) as unknown;
    } catch {
      throw ApiError.validation('AI provider returned non-JSON tool arguments');
    }

    const parsed = receptionistTurnOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw ApiError.validation(
        'AI provider returned invalid structured output',
        parsed.error.flatten(),
      );
    }

    return parsed.data;
  }
}

export function isOpenAiCompatibleConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.OPENAI_COMPAT_API_KEY);
}

export function createOpenAiCompatibleClaudeProvider(): ClaudeProvider {
  const env = getEnv();
  if (!env.OPENAI_COMPAT_API_KEY) {
    throw new Error('OPENAI_COMPAT_API_KEY is not configured');
  }
  return new OpenAICompatibleClaudeProvider(
    env.OPENAI_COMPAT_API_KEY,
    env.OPENAI_COMPAT_BASE_URL,
    env.OPENAI_COMPAT_MODEL,
  );
}
