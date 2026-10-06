# Case authoring guide

Clinical cases are TypeScript objects conforming to `MedicalCase` in `src/features/case-challenge/schema.ts`. Add one file under `src/features/case-challenge/cases/`, export it from that folder's `index.ts`, and run `npm run validate:cases`.

Every case is educational content and must remain `reviewStatus: "needs_clinician_review"` until a qualified clinician has checked the full path, including wrong-action consequences and treatment details. The app must display “Educational use only, not medical advice.”

## Core structure

- `id` is the stable database UUID. `slug` is the human-readable authoring identifier such as `case_003`.
- `intro` is the mid-scene hook and must be 40 words or fewer.
- `patient` includes character rendering parameters, voice guidance, chief complaint, and initial expression.
- `vitalsTimeline` describes important reference states. `deteriorationRules` define what happens when a time-critical action is missed.
- `actions` are the game: Ask, Examine, Test, and Treat. Each has time/cost/risk, a result, evidence links, and optional safety effects.
- `differential` must contain exactly one correct diagnosis and exactly one tempting early diagnosis.
- `hints` has exactly three escalating, non-blocking prompts. Tier 1 is free; later tiers cost points.
- `solution` powers the debrief. Keep exactly three concise teaching points and explain why the tempting diagnosis fails.
- `scoring` defines time, testing, harm, and early-clue adjustments.
- `assets` mirrors the case's `public/cases/<slug>/assets.manifest.json` entries.

## Clue tiers

Each case must contain at least one action for all three required tiers:

- `obvious`: visible early and intentionally compatible with the tempting diagnosis.
- `buried`: revealed only by the right question, examination, or targeted test. At least one reachable buried clue should be marked `isKeyClue`.
- `contradicting`: arrives around the midpoint and should force reconsideration of the early anchor.

Use `red_herring` sparingly for plausible noise and `none` for actions that do not supply diagnostic evidence. The key clue should be reachable in roughly the first 30% of an efficient run.

## Actions and evidence

Action IDs are stable and unique within a case. `supports` and `against` contain differential IDs, allowing the player to tag discovered evidence on the board. Every referenced diagnosis and asset is checked by the validator.

Mark low-value tests with `isUnnecessary`. Mark unsafe decisions with `harmful`, and reserve `immediateFailure` for credible catastrophic endpoints. If a treatment is safe only after enough evidence, document the minimum prerequisite in `safeWhen`; the engine can then score premature use separately from correct use.

Patient replies should be one or two sentences in the voice described by `patient.personality`. Test and examination results should make the case solvable without relying on specialist trivia.

## Deterioration and endings

Every time-critical case needs at least one deterioration rule. The rule identifies the action that prevents it, its deadline, vital-sign delta, alert speaker, and event. Add a later `lossAtMinute` only when continued non-treatment plausibly causes a crash.

The authored paths should permit:

1. an efficient win with early stabilisation, focused evidence, correct commitment, and correct treatment;
2. a penalised win after unnecessary tests, hints, or a recoverable unsafe action; and
3. a loss through a defined failure action or untreated deterioration.

## Medical assets

Store assets in `public/cases/<slug>/`. Every referenced `assetId` needs a manifest entry and a real file. Use verified public-domain or open-license material and show the attribution in the UI. If licensing cannot be confirmed, use a clearly labelled local placeholder and add the item to `TODO_ASSETS.md`; never invent a source URL.

## Validation checklist

Run:

```sh
npm run validate:cases
npm run build
```

The validator checks clue coverage, correct/tempting diagnosis counts, reachable key clues, action and diagnosis references, manifest membership, duplicate filenames, and physical asset existence. Clinical review remains a human release gate.
