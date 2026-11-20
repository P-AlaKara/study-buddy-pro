# Case studio (`/manage/cases`)

Authoring, clinical review and publishing for the Case Challenge, for clinicians rather than developers.
Access: the `CONTENT_CREATOR_EMAILS` allowlist, checked on the server for every operation.

## Where cases live

`public.clinical_cases` in Supabase, one row per case:

- `published`: the case students play (null until first published).
- `draft`: unpublished work, either a new case or changes to a published one. Drafts are shared: every
  content creator sees them, on any device.
- `version`: every write bumps it. Saves and publishes name the version they were based on, so two people
  editing the same case get a "someone else changed this case" choice instead of silently overwriting.

Publishing copies `draft` → `published` (refused if the automated checks find errors) and is live
immediately. Discarding drops the draft; a never-published case is deleted.

Images go to the public `case-images` bucket. The browser asks `createCaseImageUpload` for a one-time
signed URL and uploads straight to storage (bypassing Vercel's 4.5 MB request limit); the asset stores
the public `url`. Uploaded files are not deleted when an image is removed from a case (a published
version may still use them).

Migration: `supabase/migrations/20261120120000_clinical_case_bank.sql` (table, bucket, seed of the four
original cases with unchanged ids). Then `bun scripts/upload-case-images.ts --apply` moves the seed
images from `public/cases/` into storage.

## Two workflows, one clinical order

| Builder                                           | Review                         |
| ------------------------------------------------- | ------------------------------ |
| 1 Case basics & learning goals                    | 1 Patient & clinical context   |
| 2 Patient & first impressions                     | ↑                              |
| 3 History · 4 Examination · 5 Tests · 6 Treatment | 2–5 the same four action lists |
| 7 Patient progression                             | 6 Patient timeline             |
| 8 Scoring & safety                                | 7 Scoring & patient safety     |
| 9 Preview & publish                               | 8 Summary & next steps         |

Reviewers fix problems by **editing the case**: action cards open the full editor in place, and every
other section has an Edit button that opens the builder at that field (with "Back to review"). Editing a
published case starts its draft. There are no review notes or case statuses in the UI; `reviewStatus`
stays in the data, unused. Review progress (sections marked reviewed) is kept per browser.

URL: `?case=draft:<id>|bank:<id>&mode=build|review&step=<key>`. `bank:` shows the published version,
`draft:` the unpublished one.

## Files

- `studio.functions.ts`: server functions (list, create, revise, save draft, publish, discard, image
  upload URL). Storage and SQL live in `src/server/cases/case-store.server.ts`.
- `use-studio-cases.ts`: the shared library in the browser, with debounced autosave and conflict handling.
- `image-upload.ts`: browser side of image uploads.
- `vocabulary.ts`: every clinician-facing label, step name, clue type, group preset.
- `case-analysis.ts`: read-only derivations, including trajectories computed by **running the real engine**.
- `case-edits.ts`: immutable edits; renaming an internal id rewrites every reference.
- `issue-guide.ts`: validator + quality + consistency checks → plain sentence and the field to jump to.
- `drafts.ts`: case helpers (blank case, templates, shape check, `inspectCase`), plus reading drafts that
  older versions kept only in `localStorage` so the library can move them to the server.
- `reviews.ts`: sections reviewed per case, in `localStorage`.
- `components/review/*`, `components/builder/*`: the review stages and builder steps.

## Data model notes

- `CaseAction.group` (optional, engine-ignored): the clinical heading an action is filed under.
- `CaseAsset.url` (optional): where the image is served from; without it the file is read from
  `public/cases/<slug>/`.
- One correct diagnosis per case; findings are free text.
- Later `vitalsTimeline` snapshots are reference notes only; the engine reads minute 0.
- Playtests run under `<id>-playtest`, so they never touch real saved progress on that case.
