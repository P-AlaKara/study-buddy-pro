# OSCE v2 authoring guide

OSCE v2 stations are typed data. A new history-taking station should require a station file and an
export from `src/features/osce/stations/index.ts`; clinical behavior must not be hard-coded in UI
components.

Every station remains `needs_clinician_review` until a qualified reviewer has checked the content,
answer keys, urgency, safety advice, and local clinical/licensing assumptions.

## Schema at a glance

- `facts` contains stable fact IDs referenced by card reveals. Keep wording patient-specific.
- `cards` define what the student can say or do, simulated time, rapport effects, replies for low,
  mid, and high rapport, unlocks, cue windows, checklist effects, and examiner signals.
- `cues` define the patient's line, prerequisites, three-action response window, ideal response, and
  penalty for missing it.
- `curveball` references exactly four response cards. Exactly one must use
  `curveballResponseKind: "honest_empathic"`.
- `checklist` contains weighted, domain-grouped outcomes and a concrete one-line coaching prompt.
- `criticalFails` can be triggered by taking an unsafe action or by missing one or all referenced
  checklist items.
- `examinerQuestions` use keyed single- or multiple-selection options; there is never free text.
- `modelRun` is an efficient, defensible order with a short reason for every included action.
- `ratingThresholds`, nudge costs, and idle-drift settings are station-level difficulty controls.

## Card design

Write labels as natural student speech, not checklist labels. Closed and open versions of a topic
may coexist. An open question should earn its extra time by producing a richer answer or satisfying
several related checklist items. Use `unlockedBy` for follow-ups that make no sense before a fact or
cue has emerged. Use `conditionalFactReveal` for hidden facts that require mid/high rapport.

Each category needs 6-12 cards. Across the full station, 30-40% must use one of the deliberately poor
styles: `leading`, `judgmental`, `jargon`, `multi_barrelled`, `irrelevant`, or `dismissive`. Poor cards
must have believable replies and explicit consequences; they should never be cartoonishly easy to
spot. A distractor should compete for time or test phrasing judgment, not merely add random comedy.

Sensitive cards should set `sensitive: true` and an `earlyRapportPenalty`. Avoid encoding a preferred
linear script: multiple good paths should work, and Practice/Exam will shuffle available cards.

## Cue design

A cue is an unfinished thought, emotional shift, or practical detail worth acknowledging. It must
have at least one pickup card, an ideal pickup card, and a short action window. Add prerequisites when
the line only makes sense after a particular part of the history. The pickup card belongs in
`communicate` and should not be visually highlighted during play.

Do not reveal a hidden agenda simply because the cue appeared. Put the protected fact behind an ICE
card or a cue pickup with `conditionalFactReveal` at mid/high rapport.

## Tuning difficulty

- Increase `timeCostSec` on broad replies or lower `clockSeconds` to increase prioritization pressure.
- Tune cue `windowActions` and `missedRapportPenalty` to make active listening more or less demanding.
- Adjust rapport deltas and `earlyRapportPenalty` to change how quickly the patient becomes open.
- Adjust nudge costs and rating component weights without changing the conversation itself.
- Keep the model run at or below 95% of the station clock.
- Keep the sum of all useful, non-poor cards above the clock so exhaustive clicking cannot succeed.

Run `npm run validate:osce` after every authoring change. The validator checks ID integrity,
checklist coverage, cue pickup wiring, critical-fail triggers, poor-card ratio, time pressure, fact
references, examiner keys, thresholds, and the unique honest-empathic curveball response.
