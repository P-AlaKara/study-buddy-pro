# Study Buddy Pro

I'm building a mobile-first medical education platform for medical students in Rwanda. The flagship feature (built in a later step) is an interactive clinical case simulator; other tools (OSCE prep, quizzes, flashcards, groups, gamification) orbit around it. Skip authentication entirely — no login/signup/logout. Instead, build a lightweight "Acting as" student switcher (a dropdown in the top bar) that lets a tester pick between a few seeded demo student profiles. Whichever profile is selected drives all personalized data on screen. Store the selection in local state/localStorage.

DESIGN SYSTEM (apply everywhere, this is core to the product):

- Visual language: "claymorphism" — soft, puffy, 3D-looking UI. Large rounded corners (16–28px), pill-shaped buttons, soft drop shadows below elements, subtle light highlight along the top edge of raised elements, layered surfaces, no hard borders, no sharp corners, no glassmorphism, no dark heavy shadows.

- Color palette: a "candy shop" palette — bubblegum pink, lavender, sky blue, mint/pistachio green, peach, coral, lemon yellow, soft cream/off-white background. Page backgrounds stay soft cream/warm white; saturated color lives on cards and buttons, not full-screen (except achievement/celebration/onboarding moments).

- Functional color coding (use consistently everywhere these appear, including later steps): Cases = purple/lavender, OSCE = pink/coral, Quizzes = blue/aqua, Flashcards = yellow/peach, Groups = green/mint, Progress/Mastery = mixed gradient.

- Buttons: primary = strong candy color, pill shape, soft shadow, slight press-down animation on click. Secondary = pale version of category color, flatter.

- Cards: rounded, soft colored surface, gentle shadow, comfortable padding, feel clickable at a glance.

- Typography: rounded/soft-geometric headings, highly readable body font, strong hierarchy, generous line spacing. Keep long clinical text easy to scan, not overly playful.

- Icons: rounded, friendly, simple medical iconography (heart, brain, lungs, stethoscope, flame for streaks, trophy).

- Microinteractions: buttons compress on press, cards lift slightly on hover/select, smooth short transitions (no long or constant animation, especially during reading-heavy screens).

NAVIGATION:

Bottom nav (mobile-first) with 5 items: Home, Cases, Practice, Groups, Profile. "Practice" opens a sub-menu/tab view for OSCE, Quizzes, Flashcards. Keep the nav itself minimal — don't add extra top-level items as the app grows.

SUPABASE DATA MODEL — create these tables now:

- students: id, name, email, university, country, year_of_study, medical_program, current_level, subjects_studying (text array), current_rotation, specialty_interests (text array), weak_areas (text array), study_goal, daily_study_target_minutes, notification_prefs (jsonb), xp (int default 0), level (int default 1), streak_days (int default 0), longest_streak (int default 0), created_at.

Seed 4 demo students with varied universities/years/subjects/specialty interests so the switcher has real variety.

- Create empty placeholder tables we'll fill in later steps: cases, case_attempts, osce_stations, osce_attempts, quiz_questions, quiz_sessions, flashcard_decks, flashcards, flashcard_reviews, groups, group_members, achievements, student_achievements, xp_events, notifications, mastery_scores. Just get basic id/created_at columns in for now — later prompts will flesh these out with full ALTER statements, so don't worry about getting every column right yet.

ONBOARDING FLOW (multi-step, only triggered from a "Create demo profile" option, not required to use the app):

Step through: name/email → university/country/year/program → subjects currently studying → optional: rotation, specialty interests, weak areas, study goal, daily target, notification preferences. Friendly, one question group per screen, progress indicator, big soft "Continue" button. On finish, insert into students and add to the switcher.

HOME DASHBOARD ("What should I study today?"):

Build these components as cards (use placeholder/mock content where real data doesn't exist yet, but structure them to later pull from real tables):

1. Weekly Case — title/teaser, difficulty, estimated time, countdown to deadline, participant count, student's participation status, "Start Case / Continue Case" CTA (lavender/purple).

2. Continue Learning — recent unfinished activities across case/quiz/OSCE/flashcards.

3. Flashcards Due — count due, estimated review time, "Review Now" CTA (yellow/peach).

4. Recommended Practice — 3-4 recommended items (quiz/OSCE/case/deck), simple rule-based placeholder logic is fine.

5. Study Progress — daily goal ring, weekly goal, XP, level, streak flame with count.

6. Weak Areas — list of subjects with performance % (e.g. Pharmacology 54%), color-coded by severity.

7. Group Activity — recent invites/challenges/sessions.

8. Achievements — recently earned badges.

Make the whole app feel cohesive and alive even with placeholder data — real wiring happens in the next prompts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ab1b3248-3197-457f-b937-797b75fbe2f6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
