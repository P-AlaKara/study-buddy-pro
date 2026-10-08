# OSCE v2 authoring guide

OSCE v2 stations are typed data. The deterministic engine, consultation UI, scoring and debrief do
not contain station-specific branching, so adding a station should require one station file plus an
entry in `src/features/osce/stations/index.ts`.

Clinical content must be reviewed by a qualified clinician before `reviewStatus` is changed from
`needs_clinician_review` to `clinician_reviewed`.

## Authoring workflow

1. Copy an existing station in `src/features/osce/stations/` and give every entity a station-unique
   ID.
2. Fill the patient, facts, cards, cues, curveball, checklist, critical fails, examiner questions,
   model run, nudges and rating thresholds.
3. Export the station from the station index.
4. Run `npm run validate:osce`, `npm run test:osce-validator` and `npm run test:osce-engine`.
5. Play all three modes on mobile and desktop, including deliberately poor and incomplete runs.

The source of truth for field types is `src/features/osce/schema.ts`. Logic belongs in the engine or
shared reaction configuration, never inside a station data file.

## Station shape

Top-level timing is expressed in seconds. `candidateInstructions` should state the role, setting,
task and limits. `examinerNote` should clarify anything the candidate must not do. The patient
contains only presentation data and avatar configuration; all discoverable clinical information
lives in facts and card replies.

Each card defines:

- `category` and natural student-facing `label`;
- communication `style`, time cost and whether it may repeat;
- prerequisites in `unlockedBy` and an optional three-action cue window;
- low, mid and high rapport replies;
- fact reveals and checklist items satisfied or penalised;
- rapport change, examiner signal, and optional cue or curveball trigger.

Use low-rapport replies that are clipped or guarded, mid replies that answer exactly what was asked,
and high replies that volunteer a useful extra detail. Do not put answers or relevance hints in card
labels.

## Useful cards and distractors

At least 30% of authored cards must be distractors or poor technique. Use a realistic mixture of:

- leading or judgmental versions of otherwise useful questions;
- jargon and multi-barrelled wording;
- dismissive responses;
- plausible but low-value or irrelevant review-of-systems questions.

Every poor card needs an authored consequence: time cost, rapport loss, examiner reaction and, when
appropriate, a checklist penalty. Avoid cartoonishly bad wording—the learner should need to judge
between plausible alternatives.

Aim for roughly 50–60 cards overall and 6–12 cards in each populated category. Set `sensitive: true`
and an `earlyRapportPenalty` on social, family or emotional questions that should land badly when
asked before rapport is established. Use `unlockedBy` for contextual follow-ups and
`conditionalFactReveal` when a fact also requires mid or high rapport.

Open questions should be efficient and may satisfy several tightly related checklist items. Closed
questions should answer one focused point. The combined duration of all useful cards must exceed the
station clock, so prioritisation remains necessary.

## Cues and hidden information

A cue should sound like something a real patient might volunteer, not like a prompt from the app.
Give every cue:

- a trigger card and any clinical or rapport prerequisites;
- one or more pickup cards in the Communicate category;
- exactly one ideal response;
- a three-action window and a proportionate missed-rapport penalty.

Newly unlocked and cue-window cards are intentionally not highlighted. Important hidden information
may require both a specific question and sufficient rapport. ICE concerns should not leak through
unrelated cards.

The curveball should test uncertainty, empathy or safety. Provide four response styles and exactly
one `honest_empathic` response. False reassurance may trigger a critical fail when clinically
appropriate.

## Checklist and critical fails

Group checklist items into the six supported domains:

- `opening_and_consent`
- `history_content`
- `risk_and_red_flags`
- `ice`
- `communication`
- `closing_and_safety`

Every item must be satisfiable by at least one card and must have a specific, one-line coaching
message. Weights should reflect clinical importance rather than the number of words needed to ask a
question. Reserve `criticalFailIfMissing` and critical-fail rules for genuine identity, consent or
safety failures.

## Model run and difficulty tuning

`modelRun` is one defensible, efficient order—not the only correct consultation. It should finish in
roughly 80–95% of the clock, respond to cue windows, uncover the key red flag and close safely. Give
each step a reason suitable for debrief comparison.

Tune difficulty with data rather than UI hints:

- increase or decrease card time costs;
- adjust distractor similarity and proportion;
- change cue prerequisites, rapport threshold or window length;
- adjust rapport deltas and early-sensitive-question penalties;
- move the curveball trigger percentage;
- tune checklist weights, rating thresholds and communication caps;
- adjust idle drift and nudge costs.

Keep the reaction ambiguity in `src/features/osce/reaction-config.ts`. Practice and Exam true signals
are intentionally reliable about 80% of the time, neutral noise appears about 10% of the time, and
routine writing is not evidence of quality.

## Required checks

The validator rejects unsatisfiable checklist items, invalid references, cues without pickup cards,
untriggerable critical fails, insufficient distractors, an overlong model run, insufficient time
pressure, and curveballs without exactly one honest-empathic response. A passing validator confirms
structural integrity, not clinical accuracy; clinician review remains mandatory.
