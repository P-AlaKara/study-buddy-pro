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

## State-dependent results

An action's response reflects the patient at the moment it completes, not the minute-0 script:

- `variants` on a `CaseAction` are tried in order; the first whose `when` holds (`afterActions`, `notAfterActions`, `afterDeterioration`, live `vitals` ranges) is merged over the base `result`, and may replace `vitalsEffect`. Conditions see the patient after any deterioration during the action, before its own effect.
- Result text and lab values can use live tokens — `{hr}`, `{bp}`, `{sbp}`, `{dbp}`, `{rr}`, `{spo2}`, `{temp}` (with offsets such as `{sbp-34}`) and `{rhythm}` — filled in with the vitals after the action's effect.
- The engine stores the resolved result on `CompletedAction.result`; UI code reads it through `resultForAction(state, action)`, never `action.result` directly.

ECGs are generated, not shipped as files: an `ecg` result carries `ecg: { preset }` and `ecg.ts` draws a print-style 12-lead (3×4 + lead II rhythm strip, 25 mm/s, 10 mm/mV, 4:3 to fill the viewer) at the heart rate recorded when the ECG was taken. Presets cover normal sinus, early PE, PE with right-ventricular strain, LVH with strain, and LVH with a pericardial effusion (low voltage + alternans). Use `ecgAnnotation([...leads], radius, label)` for the debrief answer ring. `components/result-media.ts` turns any result into the viewer's image source and attribution.

Radiology images live in `public/cases/<slug>/` with a matching `assets.manifest.json`. They are open-licensed (CC0 / public domain / CC BY-SA) and teaching overlays such as arrows or numbered labels are removed, so the "mark finding" exercise is not given away; the attribution text records that change.

Run `npm test` after changing the schema, validator, cases, or engine. Tests cover action application, deterioration, interrupted actions, safe-treatment gates, differential history, hints, scoring, win/loss/penalised paths for both cases, and validation failures.

## Encounter UI

`components/case-challenge-screen.tsx` owns the encounter. While a case is being played it renders a fixed, full-viewport layer (`.case-immersive`): a pre-rendered hospital ward (`ward-backdrop.tsx`) fills the whole screen and every clinical control floats above it as ordinary DOM, HUD-style. The debrief renders normally inside the app shell.

From `lg` the floating layer is a three-column grid with two full-width rows above it:

- **Top bar** (`encounter-top-bar.tsx`): back, logo, case chip + title, simulated clock, efficiency, hints, signed-in initials.
- **Vitals strip** (`vitals-strip.tsx`): a slim, dark, centred bar of the five readouts (HR, BP, RR, SpO₂, Temp) with waveforms; abnormal values are tinted and critical ones pulse.
- **Left**: `case-panel.tsx`, vertically centred beside the bed — setting, title, patient identity, chief complaint, presenting tags, then the three clinical-tool launchers.
- **Centre**: the patient, with status chips (distress, speaking) at the top.
- **Right**: the complete `interaction-history.tsx` timeline filling the column (independently scrollable with a thin lavender scrollbar; its enlarge toggle widens the column).
- **Bottom centre**: `clinical-dock.tsx` — the handover before the case starts, then a compact dock of four category buttons (Ask / Examine / Test / Treat). Tapping one raises a tray of that category's actions (one scrolling row, "Show all" for a grid); tapping it again puts the ward back.
- **Bottom corners**: Dr. Ambrose (hints) on the left, **Commit diagnosis** on the right.

Surfaces are lavender-tinted, semi-transparent clay slabs (`.case-float-panel`, `.case-float-pill`, `.case-hud-*`) with modest blur so the ward reads through without hurting legibility.

Below `lg` the layer stacks: compact top bar (back, title, clock, Ambrose, history, commit), the vitals strip (readouts only), a tappable patient chip (opens the case panel as a sheet), the ward and the dock. The action tray opens as a sheet above the dock; the case panel, history and clinical tools open in `MobileSheet`s; the Ambrose hint popover drops in under the top bar. The app's own header and tab bar are hidden while the encounter is up.

There are exactly three clinical tools — patient chart, clinical notes, differentials — declared once in `WORKSPACE_TOOLS` / `workspaceToolMeta` (`components/case-constants.ts`) and consumed by both the case panel launchers and `clinical-workspace.tsx`. The workspace deliberately has **no tab strip**: it renders the single tool that was requested, with a back button to the patient, so opening "Clinical notes" never also presents the chart and differentials.

## Ward backdrop

The ward is a static image, not a live scene (the earlier Three.js / React Three Fiber ward was removed; `three` remains a dependency only for the anatomy lab).

- `components/patient-media.ts` — `wardImageForCase(case)`: an explicit `patient.model` wins, otherwise `patient.sex` picks the female or male ward render in `public/patients/` (see its `ATTRIBUTION.md`). Each entry carries a `srcset`, intrinsic size and a focal point (the patient's face, plus a phone-only horizontal nudge). Tune framing there.
- `components/ward-backdrop.tsx` — `WardBackdrop` renders the image at `object-fit: cover` with the focal point as `object-position`, fades it in once decoded, and stacks two inert light layers over it. `PatientStatusChips` renders the distress / speaking chips over the patient.
- `styles.css` (`.case-ward*`, `.case-float-*`, `.case-hud-*`) — the depth treatment: ambient light + window glow + a faint lavender→blue grade, a vignette that stays clear over the patient, and frosted, layered-shadow HUD surfaces. Keep effects cheap: gradients, `backdrop-filter` on panels only, no filters on the image and no continuous animation.

Hints have one home: the floating Dr. Ambrose button (all breakpoints) opens `HintPanel`. Do not re-add a second hint surface inside the workspace.

## Character components

`components/patient-avatar.tsx` renders the authored patient as an accessible inline SVG. Skin tone, hair, outfit, age cues, sex, expression and live respiratory rate all affect the portrait; breathing cadence is derived from the current RR. `components/dr-ambrose.tsx` provides the shared mentor in avatar and logo variants with six expressions. His identity lives in `config.ts` so hints, onboarding, loading states and debriefs use one source of truth.

Character animation is CSS-only and decorative. The global reduced-motion rule collapses it to a single frame while preserving every clinical state in text and SVG labels.

## Debrief and sharing

`components/case-debrief.tsx` turns the immutable end state into the outcome banner, chronological decision replay, found/missed clue audit, harmful-action review, score breakdown, mock comparison and annotated artifact review. It also produces a plain-text result and a downloadable SVG result card entirely in the browser; no attempt or patient data is uploaded by the sharing flow.
