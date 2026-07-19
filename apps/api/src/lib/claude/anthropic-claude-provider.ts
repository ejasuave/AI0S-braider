import Anthropic from '@anthropic-ai/sdk';
import { receptionistTurnOutputSchema } from '@project-braids/shared-types/api';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../errors.js';
import type { ClaudeCompletionRequest, ClaudeProvider } from './claude-provider.types.js';
import {
  RECEPTIONIST_TOOL_NAME,
  RECEPTIONIST_TOOL_PARAMETERS,
} from './receptionist-tool-schema.js';

const RECEPTIONIST_TOOL = {
  name: RECEPTIONIST_TOOL_NAME,
  description: 'Return the structured receptionist turn for this conversation.',
  input_schema: RECEPTIONIST_TOOL_PARAMETERS,
} as unknown as Anthropic.Tool;

export class AnthropicClaudeProvider implements ClaudeProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async completeStructuredTurn(request: ClaudeCompletionRequest): Promise<ReceptionistTurnOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: request.systemPrompt,
      tools: [RECEPTIONIST_TOOL],
      tool_choice: { type: 'tool', name: RECEPTIONIST_TOOL.name },
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const toolBlock = response.content.find(
      (block) => block.type === 'tool_use' && block.name === RECEPTIONIST_TOOL.name,
    );

    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw ApiError.internal('Claude did not return a structured receptionist turn');
    }

    const parsed = receptionistTurnOutputSchema.safeParse(toolBlock.input);
    if (!parsed.success) {
      throw ApiError.validation(
        'Claude returned invalid structured output',
        parsed.error.flatten(),
      );
    }

    return parsed.data;
  }
}

export function isClaudeConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function createAnthropicClaudeProvider(): ClaudeProvider {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new AnthropicClaudeProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
}
