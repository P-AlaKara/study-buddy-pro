-- Exam Generator.
--
-- Replaces the "Study with Annie" PDF reader with a comprehensive exam
-- generator. Students upload PDFs/PPTX; the material is extracted, mapped into
-- learning objectives, and turned into a source-grounded exam they take at
-- their own pace and mine for flashcards.
--
-- Storage policy: original documents are NEVER stored permanently. Uploaded
-- files are extracted in-memory by the server; the extracted text lives only
-- in exam_generation_jobs.extracted_content and is nulled once generation
-- finishes (done/failed/cancelled). Only the generated exam, its questions,
-- coverage map, attempts and answers persist.
--
-- As with the app-owned-auth and USMLE migrations, every table here is reached
-- only through server functions using the service-role client, so no
-- anon/authenticated grants or RLS policies are created (RLS is enabled as a
-- backstop and only service_role is granted).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Remove the Study with Annie feature (project has test users only).
--    Child tables drop via CASCADE; then the private PDF bucket + its policies.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.annie_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.annie_annotations CASCADE;
DROP TABLE IF EXISTS public.annie_commentary_candidates CASCADE;
DROP TABLE IF EXISTS public.annie_quiz_candidates CASCADE;
DROP TABLE IF EXISTS public.annie_page_overviews CASCADE;
DROP TABLE IF EXISTS public.annie_page_texts CASCADE;
DROP TABLE IF EXISTS public.annie_study_sessions CASCADE;
DROP TABLE IF EXISTS public.user_annie_settings CASCADE;
DROP TABLE IF EXISTS public.annie_documents CASCADE;

DROP TYPE IF EXISTS public.annie_quiz_result;
DROP TYPE IF EXISTS public.annie_annotation_type;
DROP TYPE IF EXISTS public.annie_document_status;

DROP POLICY IF EXISTS "Owners read Annie PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload Annie PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete Annie PDFs" ON storage.objects;
-- The Exam Generator stores no files, so the old `annie-notes` bucket is now
-- unused. Hosted Supabase rejects direct SQL deletes on storage tables
-- (SQLSTATE 42501), so the bucket and any leftover objects must be emptied and
-- removed via the Storage API or the dashboard. Dropping the policies above
-- already revokes all access to it.

-- ---------------------------------------------------------------------------
-- 2. Enums.
-- ---------------------------------------------------------------------------
CREATE TYPE public.exam_status AS ENUM ('generating', 'ready', 'partial', 'failed');
CREATE TYPE public.exam_objective_status AS ENUM ('pending', 'covered', 'partial', 'unassessable');
CREATE TYPE public.exam_question_type AS ENUM ('mcq', 'short', 'long');
CREATE TYPE public.exam_attempt_status AS ENUM ('in_progress', 'submitted');
CREATE TYPE public.exam_job_stage AS ENUM (
  'extracting', 'mapping', 'generating', 'auditing', 'done', 'failed', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- 3. Exams. One row per generated examination.
--    source_documents: [{ "name", "kind": "pdf"|"pptx", "unitCount" }]
--    coverage_summary:  { topics, typeDistribution, objectives:{covered,...}, warnings:[] }
-- ---------------------------------------------------------------------------
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  status public.exam_status NOT NULL DEFAULT 'generating',
  source_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  coverage_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE INDEX exams_student_created_idx ON public.exams (student_id, created_at DESC);
DROP TRIGGER IF EXISTS exams_updated_at ON public.exams;
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Coverage map: the granular learning objectives extracted from the notes.
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  topic text NOT NULL,
  subtopic text,
  objective text NOT NULL,
  bloom text,
  status public.exam_objective_status NOT NULL DEFAULT 'pending',
  target_questions integer NOT NULL DEFAULT 1 CHECK (target_questions >= 0),
  source_ref jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exam_objectives TO service_role;
ALTER TABLE public.exam_objectives ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_objectives_exam_idx ON public.exam_objectives (exam_id, position);

-- ---------------------------------------------------------------------------
-- 5. Questions. NO row-count limit exists anywhere: an exam may hold hundreds.
--    options:              [{ "id":"A", "text":"..." }] for MCQ, else null
--    option_explanations:  { "A":"why", "B":"why", ... } for MCQ, else null
--    rubric:               [{ "point":"...", "marks":1 }] for long, else null
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES public.exam_objectives(id) ON DELETE SET NULL,
  type public.exam_question_type NOT NULL,
  question_text text NOT NULL,
  options jsonb,
  correct_option text,
  option_explanations jsonb,
  model_answer text,
  explanation text NOT NULL DEFAULT '',
  rubric jsonb,
  topic text NOT NULL DEFAULT '',
  subtopic text,
  difficulty integer NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  bloom text,
  source_document text,
  source_ref text,
  position integer NOT NULL DEFAULT 0,
  dedup_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_questions_exam_pos_idx ON public.exam_questions (exam_id, position);
CREATE INDEX exam_questions_dedup_idx ON public.exam_questions (exam_id, dedup_hash);

-- ---------------------------------------------------------------------------
-- 6. Attempts. One resumable attempt per (exam, student); reset on retake.
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.exam_attempt_status NOT NULL DEFAULT 'in_progress',
  current_index integer NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  score numeric,
  stats jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE (exam_id, student_id)
);
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_attempts_student_idx ON public.exam_attempts (student_id, updated_at DESC);
DROP TRIGGER IF EXISTS exam_attempts_updated_at ON public.exam_attempts;
CREATE TRIGGER exam_attempts_updated_at BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Answers. Autosaved per question; MCQ correctness graded on save. Written
--    answers may carry an optional, on-demand AI verdict/feedback.
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  selected_option text,
  response_text text,
  is_correct boolean,
  ai_verdict text,
  ai_feedback text,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT ALL ON public.exam_answers TO service_role;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_answers_attempt_idx ON public.exam_answers (attempt_id);
DROP TRIGGER IF EXISTS exam_answers_updated_at ON public.exam_answers;
CREATE TRIGGER exam_answers_updated_at BEFORE UPDATE ON public.exam_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Generation jobs. Resumable pipeline state + TEMPORARY extracted content.
--    extracted_content holds per-unit source text only while generating; it is
--    set to NULL the moment the job reaches a terminal stage.
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL UNIQUE REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stage public.exam_job_stage NOT NULL DEFAULT 'extracting',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_content jsonb,
  idempotency_key text UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exam_generation_jobs TO service_role;
ALTER TABLE public.exam_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_jobs_stage_idx ON public.exam_generation_jobs (stage, locked_at);
DROP TRIGGER IF EXISTS exam_jobs_updated_at ON public.exam_generation_jobs;
CREATE TRIGGER exam_jobs_updated_at BEFORE UPDATE ON public.exam_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Which exam questions a student has saved as flashcards — powers the
--    "saved" marker in the player and prevents duplicate adds to a deck.
-- ---------------------------------------------------------------------------
CREATE TABLE public.exam_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  flashcard_id uuid REFERENCES public.flashcards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, question_id, deck_id)
);
GRANT ALL ON public.exam_flashcards TO service_role;
ALTER TABLE public.exam_flashcards ENABLE ROW LEVEL SECURITY;
CREATE INDEX exam_flashcards_student_question_idx
  ON public.exam_flashcards (student_id, question_id);

COMMIT;
