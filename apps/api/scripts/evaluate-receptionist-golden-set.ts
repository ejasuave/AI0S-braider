#!/usr/bin/env tsx
import {
  evaluateGoldenSet,
  formatGoldenSetReport,
} from '../src/modules/receptionist/evaluate-golden-set.js';

const evaluation = evaluateGoldenSet();
console.log(formatGoldenSetReport(evaluation));
process.exit(evaluation.passed ? 0 : 1);
