import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import type { ClaudeCompletionRequest, ClaudeProvider } from './claude-provider.types.js';
import { parsePreferredDateFromText } from '../../modules/receptionist/flow.js';

type ScenarioMatcher = (request: ClaudeCompletionRequest) => ReceptionistTurnOutput | null;

const KNOWN_STYLE_PATTERNS: Array<{ pattern: RegExp; styleName: string }> = [
  { pattern: /\bbox braids?\b/i, styleName: 'Box braids' },
  { pattern: /\bknotless braids?\b/i, styleName: 'Knotless braids' },
  { pattern: /\bcornrows?\b/i, styleName: 'Cornrows' },
  { pattern: /\bfrench curl\b/i, styleName: 'French curl' },
  { pattern: /\bpassion twists?\b/i, styleName: 'Passion twists' },
  { pattern: /\bbraids?\b/i, styleName: 'Box braids' },
];

function extractStyleName(content: string): string | undefined {
  for (const { pattern, styleName } of KNOWN_STYLE_PATTERNS) {
    if (pattern.test(content)) return styleName;
  }
  return undefined;
}

function parseTranscript(content: string): {
  latestClient: string;
  fullText: string;
  priceQuoted: boolean;
  slotsProposed: boolean;
} {
  const lines = content.split('\n');
  let latestClient = '';
  let fullText = '';
  let priceQuoted = false;
  let slotsProposed = false;

  for (const line of lines) {
    const match = line.match(/^(CLIENT|AI|SYSTEM|STYLIST):\s*(.*)$/i);
    if (!match) continue;
    const sender = match[1]!.toLowerCase();
    const text = match[2] ?? '';
    fullText += ` ${text}`;
    if (sender === 'client') {
      latestClient = text;
    }
    if (sender === 'ai') {
      if (/£\d/.test(text) || /about \d+ mins/i.test(text)) {
        priceQuoted = true;
      }
      if (/reply with the number/i.test(text)) {
        slotsProposed = true;
      }
    }
  }

  if (!latestClient) {
    latestClient = content;
    fullText = content;
  }

  return { latestClient, fullText, priceQuoted, slotsProposed };
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
  const { latestClient, fullText, priceQuoted, slotsProposed } = parseTranscript(content);
  const lower = latestClient.toLowerCase();
  const styleName = extractStyleName(fullText) ?? extractStyleName(latestClient);
  const preferredDate = parsePreferredDateFromText(latestClient, new Date());
  const slotPick = /(?:^|\s)([1-3])(?:\s|$)|option\s*([1-3])/i.exec(latestClient);
  const selectedSlotIndex = slotPick ? Number(slotPick[1] ?? slotPick[2]) : undefined;

  if (slotPick && slotsProposed) {
    return {
      intent: 'slot_selection',
      extracted_slots: {
        styleName,
        selectedSlotIndex,
      },
      confidence: 0.92,
      next_action: 'create_hold',
      client_message: `Perfect — I'll reserve option ${selectedSlotIndex} for you.`,
    };
  }

  if (/book|appointment|schedule|availab|book me/i.test(lower)) {
    if (styleName && (priceQuoted || slotsProposed)) {
      return {
        intent: 'new_booking',
        extracted_slots: {
          styleName,
          ...(preferredDate ? { preferredDate } : {}),
        },
        confidence: 0.9,
        next_action: 'propose_slots',
        client_message: preferredDate
          ? `Checking availability for ${preferredDate}.`
          : 'Let me find the next available appointment times for you.',
      };
    }

    return {
      intent: 'new_booking',
      extracted_slots: styleName ? { styleName, ...(preferredDate ? { preferredDate } : {}) } : {},
      confidence: 0.9,
      next_action: styleName ? 'confirm_style_price' : 'ask_clarification',
      client_message: styleName
        ? `Great — I can help with ${styleName}. Let me confirm pricing and find times for you.`
        : "I'd love to help you book! What style are you looking for, and which days work best for you?",
    };
  }

  if (styleName && (preferredDate || /saturday|sunday|monday|tuesday|wednesday|thursday|friday/i.test(lower))) {
    if (priceQuoted) {
      return {
        intent: 'new_booking',
        extracted_slots: { styleName, ...(preferredDate ? { preferredDate } : {}) },
        confidence: 0.9,
        next_action: 'propose_slots',
        client_message: preferredDate
          ? `I'll check what's open on ${preferredDate}.`
          : 'Let me find available times for you.',
      };
    }
    return {
      intent: 'new_booking',
      extracted_slots: { styleName, ...(preferredDate ? { preferredDate } : {}) },
      confidence: 0.9,
      next_action: 'confirm_style_price',
      client_message: `Got it — ${styleName}. Let me confirm pricing.`,
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

  if (styleName && !priceQuoted) {
    return {
      intent: 'new_booking',
      extracted_slots: { styleName },
      confidence: 0.88,
      next_action: 'confirm_style_price',
      client_message: `Lovely — ${styleName}. Let me confirm pricing for you.`,
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
