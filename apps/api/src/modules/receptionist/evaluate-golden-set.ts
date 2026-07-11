import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Message } from '@prisma/client';
import type { ReceptionistTurnOutput } from '@project-braids/shared-types/api';
import { shouldEscalate, detectPromptInjection } from './escalation.js';
import { mergeSlotsFromMessages } from './context.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const goldenSetRoot = join(moduleDir, 'golden-set');

export type GoldenSetEvaluationResult = {
  id: string;
  type: string;
  passed: boolean;
  error?: string;
};

type FunctionalTurn = {
  mockOutput: ReceptionistTurnOutput;
  expectedMergedSlots: Record<string, unknown>;
  expectEscalation?: boolean;
  assertClientMessage?: {
    maxQuestionMarks?: number;
    mustNotContain?: string[];
  };
};

type FunctionalFixture = {
  id: string;
  type: 'functional';
  turns: FunctionalTurn[];
};

type AdversarialFixture = {
  id: string;
  type: 'adversarial';
  clientMessage: string;
  expect: { escalate: boolean; reason?: string };
};

function loadJsonFiles(directory: string): Array<{ path: string; data: unknown }> {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const path = join(directory, name);
      return { path, data: JSON.parse(readFileSync(path, 'utf8')) as unknown };
    });
}

function toAiMessage(output: ReceptionistTurnOutput, createdAt: Date): Message {
  return {
    id: `msg-${createdAt.getTime()}`,
    conversationId: 'conv-test',
    sender: 'ai',
    content: output.client_message,
    structuredOutput: output as unknown as Message['structuredOutput'],
    providerMessageId: null,
    deliveryStatus: null,
    createdAt,
  };
}

function evaluateFunctional(fixture: FunctionalFixture): GoldenSetEvaluationResult {
  const messages: Message[] = [];
  const baseTime = Date.now();

  for (const [index, turn] of fixture.turns.entries()) {
    messages.push(toAiMessage(turn.mockOutput, new Date(baseTime + index * 1000)));

    const merged = mergeSlotsFromMessages(messages);
    for (const [key, value] of Object.entries(turn.expectedMergedSlots)) {
      if (merged[key as keyof typeof merged] !== value) {
        return {
          id: fixture.id,
          type: fixture.type,
          passed: false,
          error: `Turn ${index + 1}: expected mergedSlots.${key}=${JSON.stringify(value)}, got ${JSON.stringify(merged[key as keyof typeof merged])}`,
        };
      }
    }

    for (const key of Object.keys(merged)) {
      if (!(key in turn.expectedMergedSlots)) {
        return {
          id: fixture.id,
          type: fixture.type,
          passed: false,
          error: `Turn ${index + 1}: unexpected merged slot "${key}" = ${JSON.stringify(merged[key as keyof typeof merged])}`,
        };
      }
    }

    if (turn.expectEscalation) {
      const decision = shouldEscalate(turn.mockOutput);
      if (!decision.escalate) {
        return {
          id: fixture.id,
          type: fixture.type,
          passed: false,
          error: `Turn ${index + 1}: expected escalation`,
        };
      }
    }

    if (turn.assertClientMessage) {
      const message = turn.mockOutput.client_message;
      if (turn.assertClientMessage.maxQuestionMarks !== undefined) {
        const count = (message.match(/\?/g) ?? []).length;
        if (count > turn.assertClientMessage.maxQuestionMarks) {
          return {
            id: fixture.id,
            type: fixture.type,
            passed: false,
            error: `Turn ${index + 1}: expected at most ${turn.assertClientMessage.maxQuestionMarks} question marks`,
          };
        }
      }
      for (const phrase of turn.assertClientMessage.mustNotContain ?? []) {
        if (message.toLowerCase().includes(phrase.toLowerCase())) {
          return {
            id: fixture.id,
            type: fixture.type,
            passed: false,
            error: `Turn ${index + 1}: client_message must not contain "${phrase}"`,
          };
        }
      }
    }
  }

  return { id: fixture.id, type: fixture.type, passed: true };
}

function evaluateAdversarial(fixture: AdversarialFixture): GoldenSetEvaluationResult {
  const injected = detectPromptInjection(fixture.clientMessage);
  if (fixture.expect.escalate && !injected) {
    return {
      id: fixture.id,
      type: fixture.type,
      passed: false,
      error: 'Expected prompt injection detection to escalate',
    };
  }
  return { id: fixture.id, type: fixture.type, passed: true };
}

export function evaluateGoldenSet(): {
  results: GoldenSetEvaluationResult[];
  passRate: number;
  passed: boolean;
} {
  const results: GoldenSetEvaluationResult[] = [];

  for (const { data } of loadJsonFiles(join(goldenSetRoot, 'functional'))) {
    results.push(evaluateFunctional(data as FunctionalFixture));
  }

  for (const { data } of loadJsonFiles(join(goldenSetRoot, 'adversarial'))) {
    results.push(evaluateAdversarial(data as AdversarialFixture));
  }

  const passedCount = results.filter((result) => result.passed).length;
  const passRate = results.length === 0 ? 1 : passedCount / results.length;

  return {
    results,
    passRate,
    passed: results.every((result) => result.passed),
  };
}

export function formatGoldenSetReport(evaluation: ReturnType<typeof evaluateGoldenSet>): string {
  const lines = evaluation.results.map((result) => {
    const status = result.passed ? 'PASS' : 'FAIL';
    const detail = result.error ? ` — ${result.error}` : '';
    return `${status} [${result.type}] ${result.id}${detail}`;
  });
  lines.push('');
  lines.push(
    `Aggregate: ${(evaluation.passRate * 100).toFixed(1)}% (${evaluation.results.filter((r) => r.passed).length}/${evaluation.results.length})`,
  );
  return lines.join('\n');
}
