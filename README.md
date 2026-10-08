# Study Buddy Pro

> **Clinical content:** The two interactive demo cases are marked `clinician_reviewed`. New or revised case content must be reviewed by a qualified clinician before release. Educational use only, not medical advice.

A medical education platform for medical students. The flagship feature is an interactive clinical case simulator; other tools (OSCE prep, quizzes, flashcards, groups, gamification) orbit around it. 

DESIGN SYSTEM:

- Visual language: "claymorphism" — soft, puffy, 3D-looking UI. Large rounded corners (16–28px), pill-shaped buttons, soft drop shadows below elements, subtle light highlight along the top edge of raised elements, layered surfaces, no hard borders, no sharp corners, no glassmorphism, no dark heavy shadows.

- Color palette: a "candy shop" palette — bubblegum pink, lavender, sky blue, mint/pistachio green, peach, coral, lemon yellow, soft cream/off-white background. Page backgrounds stay soft cream/warm white; saturated color lives on cards and buttons, not full-screen (except achievement/celebration/onboarding moments).

- Functional color coding (use consistently everywhere these appear, including later steps): Cases = purple/lavender, OSCE = pink/coral, Quizzes = blue/aqua, Flashcards = yellow/peach, Groups = green/mint, Progress/Mastery = mixed gradient.

- Buttons: primary = strong candy color, pill shape, soft shadow, slight press-down animation on click. Secondary = pale version of category color, flatter.

- Cards: rounded, soft colored surface, gentle shadow, comfortable padding, feel clickable at a glance.

- Typography: rounded/soft-geometric headings, highly readable body font, strong hierarchy, generous line spacing. Keep long clinical text easy to scan, not overly playful.

- Icons: rounded, friendly, simple medical iconography (heart, brain, lungs, stethoscope, flame for streaks, trophy).

- Microinteractions: buttons compress on press, cards lift slightly on hover/select, smooth short transitions (no long or constant animation, especially during reading-heavy screens).

## Development
```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Supabase

This repository now targets the standalone Supabase project
`lvqatsptuqaqvmivfjkj`. See [docs/SUPABASE_MIGRATION.md](docs/SUPABASE_MIGRATION.md)
for the credential, CLI linking, migration, validation, and deployment steps.
