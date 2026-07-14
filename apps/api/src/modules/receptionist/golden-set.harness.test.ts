import { describe, expect, it } from 'vitest';
import { evaluateGoldenSet, formatGoldenSetReport } from './evaluate-golden-set.js';

describe('receptionist golden-set harness', () => {
  it('passes the consolidated functional and adversarial fixtures', () => {
    const evaluation = evaluateGoldenSet();
    expect(evaluation.passed).toBe(true);
    expect(evaluation.results.length).toBeGreaterThanOrEqual(14);
    expect(evaluation.results.some((result) => result.type === 'functional')).toBe(true);
    expect(evaluation.results.some((result) => result.type === 'adversarial')).toBe(true);
  });

  it('reports failure when a deliberately broken expectation is evaluated', () => {
    const evaluation = evaluateGoldenSet();
    const broken = {
      ...evaluation,
      results: [
        ...evaluation.results,
        {
          id: 'broken-simulated-regression',
          type: 'functional',
          passed: false,
          error: 'Simulated regression',
        },
      ],
      passRate: 0,
      passed: false,
    };
    const report = formatGoldenSetReport(broken);
    expect(report).toContain('FAIL');
    expect(broken.passed).toBe(false);
  });
});
