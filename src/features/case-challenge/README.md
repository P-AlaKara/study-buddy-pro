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

## Encounter UI

`components/case-challenge-screen.tsx` owns the encounter shell: Zone A (`case-sidebar.tsx`, desktop-only case context plus the clinical-tool launchers), Zone B (`patient-stage.tsx`, the immersive patient encounter) and Zone C (`interaction-history.tsx`, the full timeline).

Zone B is a 3D hospital ward with the clinical HUD floating over it. The stage hosts the scene (`scene/hospital-scene-host.tsx`) and layers ordinary React DOM on top: the patient identity panel (top-left, collapsible), status chips and the look-around / photo-view toggles (top-right), the bedside-monitor vitals panel (`VitalsMonitor` in `vitals-strip.tsx`; a strip along the bottom on phones) and the clinical-actions dock (`clinical-dock.tsx`), which overlays the bottom of the scene from `sm` and sits below the viewport on phones. Nothing clinical is rendered inside WebGL.

There are exactly three clinical tools — patient chart, clinical notes, differentials — declared once in `WORKSPACE_TOOLS` / `workspaceToolMeta` (`components/case-constants.ts`) and consumed by both the sidebar launchers and `clinical-workspace.tsx`. The workspace deliberately has **no tab strip**: it renders the single tool that was requested, with a back button to the patient, so opening "Clinical notes" never also presents the chart and differentials. Below `lg` the same three launchers live in the dock header instead of behind a drawer.

## 3D hospital scene (`scene/`)

- `scene-config.ts` — data only: patient model manifest (`PATIENT_MODELS`, `FALLBACK_PATIENT_MODEL`), ward prop layout, bed hinge, palette overrides and the three camera presets (`wide` / `standard` / `tall`, chosen by viewport aspect). Tune framing here.
- `patient-model.ts` — `resolvePatientModel(case)`: explicit `patient.model` wins, otherwise `patient.sex`; anything else uses the fallback and reports `source: "fallback"` (the HUD shows a chip).
- `patient-visual-state.ts` — `derivePatientVisualState(game, { talking })` is the only thing the scene receives from the engine. The animation sprint maps `breathing` / `cues` / `talking` onto clips here.
- `patient-figure.tsx` — loads the GLB, recolours the authored street clothes as a gown, exposes `usePatientAnimation` / `PatientAnimationController` as the hook point for future clips. The figure is static this sprint.
- `ward-props.tsx` — bed (with the head section re-pivoted on its documented hinge), procedural room shell, ward props and the procedural sheet over the patient.
- `camera-rig.tsx` — eases between presets on resize; limited `OrbitControls` only while "look around" is on.
- `hospital-scene.tsx` — the `Canvas` (demand frameloop, shadows, lights, environment), code-split via `lazy`.
- `hospital-scene-host.tsx` — client-only shell: render-tier detection (`render-tier.ts`), loading poster, slow/failed timeline, error boundary, WebGL-context-loss and the photo-view toggle. The photographic images in `public/patients/` are the poster and the fallback.

Assets live in `public/models/` (CC0; see `public/models/ATTRIBUTION.md`). Patient GLBs are meshopt + WebP compressed (~0.55 MB each); ward props are ~20 KB each.

Hints have one home: the floating Dr. Ambrose button (all breakpoints) opens `HintPanel`. Do not re-add a second hint surface inside the workspace.

## Character components

`components/patient-avatar.tsx` renders the authored patient as an accessible inline SVG. Skin tone, hair, outfit, age cues, sex, expression and live respiratory rate all affect the portrait; breathing cadence is derived from the current RR. `components/dr-ambrose.tsx` provides the shared mentor in avatar and logo variants with six expressions. His identity lives in `config.ts` so hints, onboarding, loading states and debriefs use one source of truth.

Character animation is CSS-only and decorative. The global reduced-motion rule collapses it to a single frame while preserving every clinical state in text and SVG labels.

## Debrief and sharing

`components/case-debrief.tsx` turns the immutable end state into the outcome banner, chronological decision replay, found/missed clue audit, harmful-action review, score breakdown, mock comparison and annotated artifact review. It also produces a plain-text result and a downloadable SVG result card entirely in the browser; no attempt or patient data is uploaded by the sharing flow.
