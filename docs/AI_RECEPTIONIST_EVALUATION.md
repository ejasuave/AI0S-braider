# AI Receptionist — Evaluation

Chapter 13.8 regression harness and human-in-the-loop escalation review.

## Golden-set regression suite

All functional (Ch.13.3) and adversarial (Ch.13.7) transcripts are consolidated under:

```
apps/api/src/modules/receptionist/golden-set/
├── functional/   # multi-turn slot merge, style-change invalidation, UX assertions
└── adversarial/  # injection / abuse patterns
```

Each fixture is paired with expected merged-slot state (functional) or expected escalation (adversarial).

### Run cadence

| When                                             | Command                                                   |
| ------------------------------------------------ | --------------------------------------------------------- |
| PR touching `apps/api/src/modules/receptionist/` | `pnpm --filter @project-braids/api receptionist:evaluate` |
| Nightly / pre-release                            | Same                                                      |
| Standard CI (`pnpm test`)                        | `golden-set.harness.test.ts` meta-test + unit coverage    |

The evaluation script prints per-transcript PASS/FAIL and an aggregate pass rate. Exit code `1` on any failure.

```bash
pnpm --filter @project-braids/api receptionist:evaluate
```

## Adding a new regression case

1. Reproduce the production bug in a minimal transcript.
2. Add a JSON fixture under `golden-set/functional/` or `golden-set/adversarial/`.
3. Pair it with expected `mergedSlots`, escalation reason, or injection detection outcome.
4. Run `receptionist:evaluate` — the new case must pass before merge.
5. If security-related, document the category in [AI_RECEPTIONIST_SECURITY.md](./AI_RECEPTIONIST_SECURITY.md).

## Human-in-the-loop escalation sampling

Weekly (or after prompt/threshold changes), sample recent escalations with model metadata:

```bash
pnpm --filter @project-braids/api receptionist:sample-escalations 15
```

Review each row:

- **True positive** — escalation was appropriate.
- **False positive** — AI escalated unnecessarily; consider relaxing threshold or prompt.
- **False negative** — nearby non-escalated thread should have escalated; tighten threshold or add a golden-set case.

Stylist inbox (`/stylist/inbox/[id]`) surfaces `modelConfidence` and `modelNextAction` on open escalations.

## Meta-test

`golden-set.harness.test.ts` verifies the harness reports failure when a simulated broken expectation is injected — proving regressions are not silently ignored.
