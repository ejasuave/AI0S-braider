import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import type { ClaudeCompletionRequest, ClaudeProvider } from './claude-provider.types.js';
import {
  extractStyleFromText,
  parsePreferredDateFromText,
} from '../../modules/receptionist/flow.js';

type ScenarioMatcher = (request: ClaudeCompletionRequest) => ReceptionistTurnOutput | null;

function parseTranscript(content: string): {
  latestClient: string;
  fullText: string;
} {
  const lines = content.split('\n');
  let latestClient = '';
  let fullText = '';

  for (const line of lines) {
    const match = line.match(/^(CLIENT|AI|SYSTEM|STYLIST):\s*(.*)$/i);
    if (!match) continue;
    const sender = match[1]!.toLowerCase();
    const text = match[2] ?? '';
    fullText += ` ${text}`;
    if (sender === 'client') {
      latestClient = text;
    }
  }

  if (!latestClient) {
    latestClient = content;
    fullText = content;
  }

  return { latestClient, fullText };
}

function buildUnhandledTestResponse(content: string): ReceptionistTurnOutput {
  return {
    intent: 'general',
    extracted_slots: {},
    confidence: 0.5,
    next_action: 'escalate',
    client_message: 'Let me connect you with the stylist.',
    escalation_reason: `Unhandled test message: ${content || 'unknown'}`,
  };
}

/** Minimal structured output — booking flow is resolved deterministically in the API. */
function buildDevDefaultResponse(content: string): ReceptionistTurnOutput {
  const { latestClient, fullText } = parseTranscript(content);
  const styleName = extractStyleFromText(fullText) ?? extractStyleFromText(latestClient);
  const preferredDate = parsePreferredDateFromText(latestClient, new Date());

  return {
    intent: styleName ? 'new_booking' : 'general',
    extracted_slots: {
      ...(styleName ? { styleName } : {}),
      ...(preferredDate ? { preferredDate } : {}),
    },
    confidence: 0.9,
    next_action: styleName ? 'confirm_style_price' : 'answer_faq',
    client_message: 'Thanks for your message.',
  };
}

export class MockClaudeProvider implements ClaudeProvider {
  private scenarios: ScenarioMatcher[] = [];
  private fallback: ReceptionistTurnOutput | null = null;

  addScenario(matcher: ScenarioMatcher): void {
    this.scenarios.unshift(matcher);
  }

  setFallback(output: ReceptionistTurnOutput): void {
    this.fallback = output;
  }

  clear(): void {
    this.scenarios = [];
    this.fallback = null;
  }

  clearScenarios(): void {
    this.scenarios = [];
  }

  async completeStructuredTurn(request: ClaudeCompletionRequest): Promise<ReceptionistTurnOutput> {
    for (const matcher of this.scenarios) {
      const result = matcher(request);
      if (result) return result;
    }

    if (this.fallback) return this.fallback;

    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
    const content = lastUser?.content ?? '';

    if (process.env.NODE_ENV === 'test') {
      return buildUnhandledTestResponse(content);
    }

    return buildDevDefaultResponse(content);
  }
}

let mockProvider: MockClaudeProvider | undefined;

export function getMockClaudeProvider(): MockClaudeProvider {
  if (!mockProvider) {
    mockProvider = new MockClaudeProvider();
  }
  return mockProvider;
}

export function isClaudeMockMode(): boolean {
  return mockProvider !== undefined;
}
