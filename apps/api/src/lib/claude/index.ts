import { getEnv } from '../../config/env.js';
import { isClaudeConfigured, createAnthropicClaudeProvider } from './anthropic-claude-provider.js';
import type { ClaudeProvider } from './claude-provider.types.js';
import { getMockClaudeProvider } from './mock-claude-provider.js';

let provider: ClaudeProvider | undefined;

export function getClaudeProvider(): ClaudeProvider {
  if (!provider) {
    const mock = getMockClaudeProvider();
    if (!isClaudeConfigured()) {
      provider = mock;
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
  return isClaudeConfigured() && getEnv().AI_RECEPTIONIST_ENABLED;
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
