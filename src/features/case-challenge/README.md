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

## Character components

`components/patient-avatar.tsx` renders the authored patient as an accessible inline SVG. Skin tone, hair, outfit, age cues, sex, expression and live respiratory rate all affect the portrait; breathing cadence is derived from the current RR. `components/dr-ambrose.tsx` provides the shared mentor in avatar and logo variants with six expressions. His identity lives in `config.ts` so hints, onboarding, loading states and debriefs use one source of truth.

Character animation is CSS-only and decorative. The global reduced-motion rule collapses it to a single frame while preserving every clinical state in text and SVG labels.

## Debrief and sharing

`components/case-debrief.tsx` turns the immutable end state into the outcome banner, chronological decision replay, found/missed clue audit, harmful-action review, score breakdown, mock comparison and annotated artifact review. It also produces a plain-text result and a downloadable SVG result card entirely in the browser; no attempt or patient data is uploaded by the sharing flow.
