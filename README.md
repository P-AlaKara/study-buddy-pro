# Medley

Medley is an interactive study platform built primarily for medical and health-science students. It brings clinical reasoning, OSCE practice, quizzes, flashcards, USMLE coaching, and focused note reading into one learning space.

Rather than treating studying as a collection of disconnected tasks, Medley helps students move between learning a concept, recalling it, applying it to a patient, reflecting on feedback, and returning to the areas that need more work. Its flagship clinical case simulator is supported by a wider set of tools, including the AI-assisted **Exam Generator** that turns lecture notes into comprehensive exams.

## The problem Medley aims to solve

Students often have plenty of learning material but not enough opportunities to use it actively. Notes and recorded lectures encourage passive review, question banks can feel detached from real clinical decisions, and practising communication or examination skills without a partner is difficult. At the same time, study activity is commonly spread across several apps, making it harder to see progress or decide what to practise next.

Medley addresses five related problems:

- **Passive studying:** rereading and highlighting can create familiarity without reliable recall.
- **The theory-to-practice gap:** knowing a fact is different from recognising when it matters in a clinical encounter.
- **Limited feedback:** learners may finish a question or station without understanding the reasoning behind the result.
- **Fragmented workflows:** notes, flashcards, quizzes, cases, and exam coaching are often kept in separate tools.
- **Inconsistent motivation:** long study plans are easier to sustain when progress is visible and practice feels purposeful.

## How Medley helps

| Learning challenge                      | Medley's response                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Notes are easy to read passively        | The Exam Generator turns uploaded notes into a comprehensive, source-grounded exam covering the whole topic.                |
| Clinical knowledge can feel abstract    | Branching case challenges ask students to gather evidence, manage time, commit to decisions, and review the consequences.   |
| OSCE practice is hard to organise alone | Structured stations simulate the door note, patient interaction, examiner questions, and scored debrief.                    |
| Students forget what they have reviewed | Quizzes, retry modes, bookmarks, and spaced-repetition flashcards bring important material back at useful moments.          |
| Weak areas are difficult to identify    | Practice history, explanations, debriefs, and topic performance make gaps more visible.                                     |
| USMLE prep is hard to navigate alone    | USMLE Prep connects students with coaches for structured classes, reviews, enrollment, direct messaging, and announcements. |

The product is designed around active recall, deliberate practice, immediate feedback, and repeated application. It is a learning aid—not a source of clinical advice or a substitute for institutional teaching, supervision, or validated clinical guidance.

## Features

### Personal study dashboard

- A central study space for reaching cases, OSCE stations, quizzes, flashcards, USMLE Prep, and the Exam Generator.
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

### Exam Generator

The Exam Generator turns a student's own lecture notes into a comprehensive, source-grounded examination.

- Authenticated students upload one or more text-based PDFs or PowerPoint (`.pptx`) files; the material is extracted in-memory and combined into a single exam.
- A structured, multi-stage pipeline analyses every document, builds a coverage map of granular learning objectives, generates questions objective by objective, then audits coverage and fills gaps — prioritising comprehensive breadth over an arbitrary question count.
- Each exam mixes single-best-answer MCQs (with per-option explanations), short-answer recall prompts, and structured long-answer questions with model answers and marking rubrics, tagged by Bloom level where useful.
- Questions are grounded only in the uploaded material, carry a source document and page/slide reference, and are checked for duplicates and near-duplicates before being saved.
- Students take the exam at their own pace: one question at a time, a question navigator, autosave, flag-for-review, skip-and-return, and resume from the last position — designed for long sessions of hundreds of questions. Display pagination never limits how many questions are generated or stored.
- Any exam question can be saved to a new or existing flashcard deck in a couple of clicks, reusing Medley's spaced-repetition flashcards.
- Exam mode keeps answers hidden until submission. The results summary is computed deterministically (no AI): score, correct, missed, saved cards, and per-topic performance to guide revision. The post-submit review reveals correct answers, explanations, and model answers, with optional on-demand AI grading and feedback for written answers.
- Generation is resumable: progress is saved after every batch, so a closed tab or interruption resumes where it left off, and partial or unassessable coverage is reported honestly rather than presented as complete.

Only text-based documents are supported; scanned or image-only files are clearly rejected (OCR is not included). The uploaded files and extracted text are **never stored permanently** — only the generated exam, its questions, coverage map, attempts, answers, and saved flashcards persist, so students can return to an exam without re-uploading their notes.

### Quizzes

- Quick, topic, adaptive, timed, previous-mistake, and bookmarked-question modes.
- Coverage across anatomy, physiology, biochemistry, pathology, and pharmacology.
- Explanations for every answer option so a question teaches as well as assesses.
- Topic accuracy, session history, saved questions, and targeted retry workflows.

### Flashcards

- Official, personal, and saved decks organised by subject.
- Create and edit personal decks of your own.
- Spaced-repetition reviews with due-card counts and review scheduling.
- Suggested cards built from saved review material and quiz practice.

### USMLE Prep

- Register as a student or as a USMLE coach when creating your account.
- Coaches publish a profile (bio, qualifications, areas of expertise, availability) and run classes.
- Students browse coaches, read reviews and ratings, and enroll in classes.
- Coaches manage classes and enrolled students from a dedicated dashboard.
- Private coach ↔ student direct messaging, plus class-wide announcements from coaches.

### Progress and motivation

- Student profiles with goals, strengths, learning progress, level, and XP.
- Weekly, monthly, case, university, and year-based leaderboards.
- Friendly achievements and progress cues that reward consistent practice across the platform.

## A typical learning loop

1. Generate a comprehensive exam from your lecture notes in the Exam Generator.
2. Work through the exam at your own pace, saving tricky questions to flashcards as you go.
3. Review difficult concepts with scheduled flashcards.
4. Apply the knowledge in a clinical case or OSCE station.
5. Use the debrief and progress views to choose the next area to revisit.
6. Enroll with a USMLE coach and message them when you want structured guidance.

## Privacy and learning safety

- **Application-owned authentication:** accounts use email and password with Argon2id password hashing and an app-signed, httpOnly session cookie. Email verification and password reset are intentionally deferred and must be added before production.
- All database access flows through authenticated server functions using a service-role client; the browser has no direct table access.
- Uploaded documents are never stored permanently: the Exam Generator extracts text in-memory, keeps it only transiently while generating, and discards both the files and the extracted text when generation finishes, fails, or is cancelled. Only the generated exam is saved.
- Generated exams, questions, coverage maps, attempts, answers, and saved flashcards belong to the authenticated student and are protected by the same authorization rules as the rest of the app.
- Generated questions are validated against a strict schema, grounded in the uploaded material, and de-duplicated before persistence.
- Model output is schema-validated, retried once when malformed, and replaced with safe fallbacks when generation fails or times out.
- Students should verify medical content against their curriculum and authoritative clinical guidance.

## Technology

- **Application:** React 19, TypeScript, TanStack Start, TanStack Router, and Vite
- **Interface:** Tailwind CSS, Radix UI primitives, Lucide icons, and Recharts
- **Data and authentication:** application-owned accounts (Argon2id hashing + app-signed session cookies) on Supabase PostgreSQL and Storage, with all access through server functions
- **Document extraction:** PDF.js (PDF) and fflate (PPTX), server-side only
- **AI assistance:** OpenAI for the Exam Generator and Gemini for OSCE, both with structured, Zod-validated output
- **Validation and testing:** Zod, TypeScript-based validators, and deterministic engine tests
- **Deployment:** Nitro server output with a Render blueprint

## Development

### Requirements

- Node.js `>=22.12.0 <23.0.0`
- npm or Bun
- A Supabase project for data (PostgreSQL) and PDF storage
- An OpenAI API key for the Exam Generator (required to generate exams); a Gemini API key for OSCE AI features

### Local setup

```sh
git clone <this-repository-url>
cd study-buddy-pro
cp .env.example .env
npm install
npm run dev
```

Set the Supabase values in `.env` before starting the app. Never expose `SUPABASE_SECRET_KEY` in client-side code or commit real credentials. `OPENAI_API_KEY` (and the optional `OPENAI_MODEL*` overrides) power the Exam Generator; `GEMINI_API_KEY` and `GEMINI_MODEL` remain server-side settings for OSCE AI features. All model keys stay server-side.

The Exam Generator (shown as **Exam Generator** in the navigation) is always enabled. If you ever need to take it offline, set `EXAM_GENERATOR_ENABLED` to `false` in `src/features/exam-generator/feature-flag.ts` and rebuild. It is deliberately a code constant rather than an environment variable so a stale value in a deployment environment can never hide or expose it unexpectedly.

Apply the migrations in `supabase/migrations` to the configured Supabase project before testing data-backed features. The Exam Generator migration replaces the former Study with Annie tables and persists only generated exams, never uploaded documents. It also revokes access to the old `annie-notes` storage bucket; that now-unused bucket should be emptied and removed from the Supabase dashboard (hosted Supabase does not allow deleting storage objects from SQL).

### Useful commands

```sh
npm run dev             # Start the local development server
npm run build           # Create a production build
npm run start           # Run the built server
npm run lint            # Run ESLint
npm test                # Run case, OSCE, Exam Generator, and auth validation/engine tests
npm run validate:cases  # Validate clinical case definitions
npm run validate:osce   # Validate OSCE station definitions
npm run test:exams      # Test Exam Generator pipeline, extraction, grading, and flashcards
```

## Design system

Medley uses a friendly **claymorphism** visual language: soft, puffy, three-dimensional surfaces with large rounded corners, pill-shaped buttons, gentle shadows, and subtle highlights. The interface avoids hard borders, sharp corners, glass effects, and heavy shadows.

- **Palette:** bubblegum pink, lavender, sky blue, mint/pistachio, peach, coral, lemon yellow, and soft cream. Page backgrounds remain quiet while cards and actions carry stronger colour.
- **Feature colours:** cases use purple/lavender; OSCE uses pink/coral; quizzes use blue/aqua; flashcards use yellow/peach; USMLE Prep uses green/mint; progress uses a mixed gradient.
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
│   ├── auth/                   # Application-owned accounts and session handling
│   ├── case-challenge/         # Case content, engine, validation, and UI
│   ├── osce/                   # OSCE stations, engine, debrief, and UI
│   ├── exam-generator/         # Upload, extraction, generation pipeline, player, and review
│   └── usmle/                  # Coach profiles, classes, enrollments, and messaging
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
- Save the generated exam, not the uploaded notes, and keep controls visible, predictable, and accessible.
- Support focused individual study first, then add collaboration where it improves learning.
