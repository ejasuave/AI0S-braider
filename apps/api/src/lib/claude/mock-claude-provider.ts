import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import type { ClaudeCompletionRequest, ClaudeProvider } from './claude-provider.types.js';

type ScenarioMatcher = (request: ClaudeCompletionRequest) => ReceptionistTurnOutput | null;

const KNOWN_STYLE_PATTERNS: Array<{ pattern: RegExp; styleName: string }> = [
  { pattern: /\bbox braids?\b/i, styleName: 'Box braids' },
  { pattern: /\bknotless braids?\b/i, styleName: 'Knotless braids' },
  { pattern: /\bcornrows?\b/i, styleName: 'Cornrows' },
  { pattern: /\bfrench curl\b/i, styleName: 'French curl' },
  { pattern: /\bpassion twists?\b/i, styleName: 'Passion twists' },
];

function extractStyleName(content: string): string | undefined {
  for (const { pattern, styleName } of KNOWN_STYLE_PATTERNS) {
    if (pattern.test(content)) return styleName;
  }
  return undefined;
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

function buildDevDefaultResponse(content: string): ReceptionistTurnOutput {
  const lower = content.toLowerCase();
  const styleName = extractStyleName(content);

  if (/book|appointment|available|slot|schedule|availab/i.test(lower)) {
    return {
      intent: 'new_booking',
      extracted_slots: styleName ? { styleName } : {},
      confidence: 0.9,
      next_action: styleName ? 'confirm_style_price' : 'ask_clarification',
      client_message: styleName
        ? `Great — I can help with ${styleName}. Let me confirm pricing and find times for you.`
        : "I'd love to help you book! What style are you looking for, and which days work best for you?",
    };
  }

  if (/price|cost|how much|£|\bpound/i.test(lower)) {
    return {
      intent: 'faq',
      extracted_slots: styleName ? { styleName } : {},
      confidence: 0.88,
      next_action: styleName ? 'confirm_style_price' : 'ask_clarification',
      client_message: styleName
        ? `I can share pricing for ${styleName}.`
        : "I can help with pricing once I know the style you're after. Which braiding style are you interested in?",
    };
  }

  return {
    intent: 'general',
    extracted_slots: {},
    confidence: 0.85,
    next_action: 'answer_faq',
    client_message:
      "Thanks for getting in touch! I can help with bookings, pricing, and availability. What would you like to do today?",
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
