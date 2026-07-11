import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ClaudeCompletionRequest = {
  systemPrompt: string;
  messages: ClaudeMessage[];
};

export interface ClaudeProvider {
  completeStructuredTurn(request: ClaudeCompletionRequest): Promise<ReceptionistTurnOutput>;
}
