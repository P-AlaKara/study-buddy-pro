# OSCE v2 engine

The OSCE engine is a deterministic, framework-free state machine. It never reads the network,
browser storage, wall clock, or UI state. Callers provide a whole-number session seed so Practice
and Exam card shuffling can be replayed exactly in the debrief.

## Lifecycle

1. `createInitialOsceState(station, mode, seed)` creates the 60-second door state.
2. `advanceReadingCountdown` or `skipReading` updates reading time; `enterRoom` rings the bell.
3. Render `getAvailableCards`, then pass a chosen ID to `selectOsceCard`.
4. Call `advanceIdleTime` from a UI timer and `markStudentActive` for non-card interaction.
5. The final bell or `endConsultation` moves to `examiner_questions`.
6. `answerExaminerQuestion` moves to `debrief` after the final keyed answer and attaches the result.

All transitions return a new state. The input state is not mutated.

## Timing policy

Authored card costs always consume simulated station time. Learn mode pauses while idle. Practice
starts idle drift after the authored grace period and advances at the authored real-to-simulated
ratio. Exam mode is strict: every whole idle real second consumes one station second. This preserves
the explicit idle-drift mechanic while making the three modes meaningfully different.

## Scoring

Checklist items are weighted and cease to earn their weight if a selected card explicitly penalises
them. Communication combines its checklist domain with final rapport. Time management combines key
item completion with time wasted on poor-technique cards. Examiner questions are scored separately,
and Practice nudge costs are deducted after weighted components are combined.

Authored critical fails cap the result at `clear_fail`. Station-level communication gates can cap an
otherwise high result at `borderline`, ensuring checklist coverage cannot compensate for seriously
poor rapport or communication.
