# Case challenge engine

`engine.ts` is a pure, immutable state machine. It has no React, browser, Supabase, or clock dependencies, so the same case definition can drive the desktop/mobile UI and deterministic tests.

The state flow is:

```text
hook → investigate ⇄ commit → debrief
           │                    ▲
           └── deterioration ───┘
```

Use `createInitialState` and `beginCase`, then apply actions or differential changes. Action time is clinical case time rather than wall-clock time. When an action crosses a deadline, the engine inserts deterioration events at the authored minute; a long action is interrupted if the patient crashes before it completes.

The differential API records add, remove, rank, confidence, and evidence-tag changes with a timestamp and snapshot. `requestNextHint` follows authored tiers and point costs. `openCommit` freezes investigation actions until commitment is cancelled or submitted.

`commitCase` resolves diagnosis and treatment selections into `diagnosed`, `missed`, or `patient_lost`. `createDebrief` returns found/missed clues, harmful-action explanations, the replay timeline, teaching points, and the score breakdown.

Run `npm test` after changing the schema, validator, cases, or engine. Tests cover action application, deterioration, interrupted actions, safe-treatment gates, differential history, hints, scoring, win/loss/penalised paths for both cases, and validation failures.
