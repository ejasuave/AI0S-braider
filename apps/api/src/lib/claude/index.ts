import { getEnv } from '../../config/env.js';
import {
  isClaudeConfigured,
  createAnthropicClaudeProvider,
} from './anthropic-claude-provider.js';
import type { ClaudeProvider } from './claude-provider.types.js';
import { getMockClaudeProvider } from './mock-claude-provider.js';
import {
  createOpenAiCompatibleClaudeProvider,
  isOpenAiCompatibleConfigured,
} from './openai-compatible-claude-provider.js';

let provider: ClaudeProvider | undefined;

export function isAiModelConfigured(): boolean {
  const env = getEnv();
  if (env.AI_PROVIDER === 'openai_compatible') {
    return isOpenAiCompatibleConfigured();
  }
  return isClaudeConfigured();
}

export function getClaudeProvider(): ClaudeProvider {
  if (!provider) {
    if (!isAiModelConfigured()) {
      provider = getMockClaudeProvider();
    } else if (getEnv().AI_PROVIDER === 'openai_compatible') {
      provider = createOpenAiCompatibleClaudeProvider();
    } else {
      provider = createAnthropicClaudeProvider();
    }
  }
  return provider;
}

export function setClaudeProvider(next: ClaudeProvider): void {
  provider = next;
}

export function isReceptionistLiveMode(): boolean {
  return isAiModelConfigured() && getEnv().AI_RECEPTIONIST_ENABLED;
}

export {
  getMockClaudeProvider,
  isClaudeMockMode,
  MockClaudeProvider,
} from './mock-claude-provider.js';
export type {
  ClaudeProvider,
  ClaudeCompletionRequest,
  ClaudeMessage,
} from './claude-provider.types.js';
