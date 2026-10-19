# Medley

Medley is an interactive study platform built primarily for medical and health-science students. It brings clinical reasoning, OSCE practice, quizzes, flashcards, collaborative study, and focused note reading into one learning space.

Rather than treating studying as a collection of disconnected tasks, Medley helps students move between learning a concept, recalling it, applying it to a patient, reflecting on feedback, and returning to the areas that need more work. Its flagship clinical case simulator is supported by a wider set of tools, including the AI-assisted **Study with Annie** PDF reader.

## The problem Medley aims to solve

Students often have plenty of learning material but not enough opportunities to use it actively. Notes and recorded lectures encourage passive review, question banks can feel detached from real clinical decisions, and practising communication or examination skills without a partner is difficult. At the same time, study activity is commonly spread across several apps, making it harder to see progress or decide what to practise next.

Medley addresses five related problems:

- **Passive studying:** rereading and highlighting can create familiarity without reliable recall.
- **The theory-to-practice gap:** knowing a fact is different from recognising when it matters in a clinical encounter.
- **Limited feedback:** learners may finish a question or station without understanding the reasoning behind the result.
- **Fragmented workflows:** notes, flashcards, quizzes, cases, and group study are often kept in separate tools.
- **Inconsistent motivation:** long study plans are easier to sustain when progress is visible and practice feels purposeful.

## How Medley helps

| Learning challenge                      | Medley's response                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Notes are easy to read passively        | Study with Annie turns uploaded notes into an annotated reader with contextual prompts and recall questions.              |
| Clinical knowledge can feel abstract    | Branching case challenges ask students to gather evidence, manage time, commit to decisions, and review the consequences. |
| OSCE practice is hard to organise alone | Structured stations simulate the door note, patient interaction, examiner questions, and scored debrief.                  |
| Students forget what they have reviewed | Quizzes, retry modes, bookmarks, and spaced-repetition flashcards bring important material back at useful moments.        |
| Weak areas are difficult to identify    | Practice history, explanations, debriefs, and topic performance make gaps more visible.                                   |
| Studying can feel isolated              | Groups support chat, shared resources, group quizzes, team cases, and friendly competition.                               |

The product is designed around active recall, deliberate practice, immediate feedback, and repeated application. It is a learning aid—not a source of clinical advice or a substitute for institutional teaching, supervision, or validated clinical guidance.

## Features

### Personal study dashboard

- A central study space for reaching cases, OSCE stations, quizzes, flashcards, groups, and Study with Annie.
- Student progress, current goals, strengths, weak areas, XP, levels, and recent activity in one place.
- Suggested next actions that make it easier to continue a useful study session instead of deciding from scratch.

### Clinical case challenges

- Interactive, branching cases that progress from the initial presentation through investigation, commitment, and debrief.
- Evidence gathering, differential diagnoses, investigations, treatment decisions, and simulated clinical time.
- Patient deterioration and changing findings that make prioritisation meaningful.
- Optional hints and a mentor character for support without removing the need to reason.
- Scored outcomes, teaching points, missed evidence, and shareable result summaries.
- A deterministic case engine so the same decisions produce consistent, testable outcomes.

### OSCE practice

- A timed door-note stage followed by a simulated consultation and examiner questions.
- **Learn**, **Practice**, and **Exam** modes for different levels of guidance.
- Structured question choices, patient responses, visible time management, and station progression.
- Debriefs across relevant domains such as information gathering, clinical reasoning, rapport, and time management.
- Critical-fail handling and saved progress for realistic, repeatable station practice.

### Study with Annie

Study with Annie is a private PDF workspace that turns a student's own notes into a more active reading session.

- Authenticated students can upload text-based PDFs up to 25 MB and see processing, ready, and failure states in their library.
- A distraction-reduced PDF.js reader provides page navigation, zoom, selectable text, and light, dark, and sepia themes.
- Highlights in four colours, page-anchored sticky notes, and bookmarks persist per student and document.
- Annie appears as a collapsible study companion with **Stern**, **Friendly**, and **Cheeky** moods. Mood changes tone, not factual accuracy.
- Contextual commentary explains why a passage matters, flags a common mistake, offers an analogy, or nudges a student who has stayed on a page for a while.
- Blot-out quizzes hide an exact passage from the current page and ask the student to recall it. Answers can be graded as correct, partially correct, or incorrect before the source text is revealed.
- Students can ask Annie a short question about the current page or request a quiz immediately.
- A rules-based scheduler respects active scrolling, note typing, open interactions, cooldowns, and the pages the student has actually reached.
- Chattiness controls, per-behaviour toggles, and silence options for ten minutes, the current session, or until manually re-enabled.
- Session summaries report pages covered, quiz performance, and passages worth revisiting—without adding streaks or XP to note reading.
- Gemini can generate and phrase grounded study interactions. Deterministic candidates, grading heuristics, and mood-specific fallback lines keep the reader usable when the model is unavailable.

Annie's Version 1 only supports PDFs with extractable text; scanned documents are clearly rejected because OCR is not included. Commentary is grounded in the uploaded notes, and any additional context is labelled **Beyond your notes**. Version 1 intentionally excludes text-to-speech, mnemonics, source recommendations, cross-session spaced repetition, social reading, and multiple companion characters.

### Quizzes

- Quick, topic, adaptive, timed, previous-mistake, and bookmarked-question modes.
- Coverage across anatomy, physiology, biochemistry, pathology, and pharmacology.
- Explanations for every answer option so a question teaches as well as assesses.
- Topic accuracy, session history, saved questions, and targeted retry workflows.
- Group quiz support for shared practice.

### Flashcards

- Official, personal, and saved decks organised by subject.
- Create and edit personal decks, then share useful material with a study group.
- Spaced-repetition reviews with due-card counts and review scheduling.
- Suggested cards built from saved review material and quiz practice.

### Study groups

- Create a group or join one with an invite code.
- Real-time group chat, member roles, shared notes, links, and flashcard decks.
- Start group quizzes and team clinical cases from the group space.
- Group XP, member activity, and a daily group quiz snapshot.

### Progress and motivation

- Student profiles with goals, strengths, learning progress, level, and XP.
- Weekly, monthly, case, group, university, and year-based leaderboards.
- Friendly achievements and progress cues that reward consistent practice across the platform.

## A typical learning loop

1. Read lecture notes in Study with Annie, adding highlights and sticky notes.
2. Use Annie's blot-outs or a Medley quiz to practise recall.
3. Review difficult concepts with scheduled flashcards.
4. Apply the knowledge in a clinical case or OSCE station.
5. Use the debrief and progress views to choose the next area to revisit.
6. Practise or discuss the material with a study group when collaboration helps.

## Privacy and learning safety

- **Prototype authentication:** Study with Annie currently accepts an email and starts the session immediately without verifying email ownership. Do not use it for sensitive material; verified authentication must be restored before production.
- Study with Annie documents are stored privately and are accessible only to their owner through authenticated, time-limited access.
- Database row-level security protects documents, extracted page text, annotations, Annie settings, attempts, and study sessions.
- Uploaded note content is handled only as needed to extract text and produce document-grounded interactions.
- Candidate blot-outs are validated against the extracted page text before they can be used.
- Model output is schema-validated, retried once when malformed, and replaced with safe fallbacks when generation fails or times out.
- Students should verify medical content against their curriculum and authoritative clinical guidance.

## Technology

- **Application:** React 19, TypeScript, TanStack Start, TanStack Router, and Vite
- **Interface:** Tailwind CSS, Radix UI primitives, Lucide icons, and Recharts
- **Data and authentication:** Supabase Auth, PostgreSQL, Storage, Realtime, and row-level security
- **Document reader:** PDF.js
- **AI assistance:** Gemini, with structured validation and deterministic fallbacks
- **Validation and testing:** Zod, TypeScript-based validators, and deterministic engine tests
- **Deployment:** Nitro server output with a Render blueprint

## Development

### Requirements

- Node.js `>=22.12.0 <23.0.0`
- npm or Bun
- A Supabase project for authentication, data, realtime features, and PDF storage
- A Gemini API key if AI-generated Annie interactions are required; the deterministic fallback experience works without one

### Local setup

```sh
git clone <this-repository-url>
cd study-buddy-pro
cp .env.example .env
npm install
npm run dev
```

Set the Supabase values in `.env` before starting the app. Never expose `SUPABASE_SECRET_KEY` in client-side code or commit real credentials. `GEMINI_API_KEY` and `GEMINI_MODEL` are optional server-side settings for Study with Annie.

Study with Annie (shown as **AI Study** in the navigation) is enabled by default. If you ever need to hide its navigation, routes, and server functions, set the following build-time flag and create a new build:

```sh
VITE_ENABLE_STUDY_WITH_ANNIE="false"
```

Leaving the variable unset (or any value other than `"false"`) keeps the feature live. Because this is a build-time Vite flag, changing it requires a new build.

Apply the migrations in `supabase/migrations` to the configured Supabase project before testing data-backed features. The Study with Annie migration also creates its private document bucket and access policies.

### Useful commands

```sh
npm run dev             # Start the local development server
npm run build           # Create a production build
npm run start           # Run the built server
npm run lint            # Run ESLint
npm test                # Run case, OSCE, and Annie validation/engine tests
npm run validate:cases  # Validate clinical case definitions
npm run validate:osce   # Validate OSCE station definitions
npm run test:annie      # Test Annie scheduling and candidate validation
```

## Design system

Medley uses a friendly **claymorphism** visual language: soft, puffy, three-dimensional surfaces with large rounded corners, pill-shaped buttons, gentle shadows, and subtle highlights. The interface avoids hard borders, sharp corners, glass effects, and heavy shadows.

- **Palette:** bubblegum pink, lavender, sky blue, mint/pistachio, peach, coral, lemon yellow, and soft cream. Page backgrounds remain quiet while cards and actions carry stronger colour.
- **Feature colours:** cases use purple/lavender; OSCE uses pink/coral; quizzes use blue/aqua; flashcards use yellow/peach; groups use green/mint; progress uses a mixed gradient.
- **Buttons:** strong candy colours for primary actions and pale category colours for secondary actions, with pill shapes and a subtle press interaction.
- **Cards:** generous spacing, rounded surfaces, gentle elevation, and an immediately clickable appearance.
- **Typography:** rounded, soft-geometric headings paired with highly readable body text and generous line spacing for longer clinical content.
- **Icons:** simple, rounded medical and learning symbols such as hearts, brains, lungs, stethoscopes, flames, and trophies.
- **Motion:** short press, lift, and transition effects; no persistent animation during reading-heavy experiences.

## Project structure

```text
src/
├── components/                 # Shared UI and application shell
├── features/
│   ├── case-challenge/         # Case content, engine, validation, and UI
│   ├── osce/                   # OSCE stations, engine, debrief, and UI
│   └── study-with-annie/       # PDF reader, Annie, scheduler, and settings
├── integrations/supabase/      # Supabase client and generated types
├── lib/                        # Quiz, flashcard, and shared domain helpers
└── routes/                     # File-based application routes

scripts/                        # Validation and deterministic test scripts
supabase/migrations/            # Database schema, policies, storage, and seeds
```

## Product principles

- Make students think and decide, not just consume content.
- Explain outcomes clearly enough that mistakes become useful.
- Keep personality warm and motivating without weakening academic accuracy.
- Ground AI interactions in the learner's source material and degrade gracefully when AI is unavailable.
- Protect student documents and keep controls visible, predictable, and accessible.
- Support focused individual study first, then add collaboration where it improves learning.
