-- Exam Generator: student-directed focus.
--
-- Adds an optional `focus_areas` note to exams. NULL = a general, comprehensive
-- exam (the default). A non-empty value means the student asked to concentrate
-- the exam on the listed areas — this powers both the "Specific" exam mode on
-- the upload screen and the weak-areas retake offered after an exam is
-- completed (the student's weakest topics are pre-filled as the focus).
--
-- Plain DDL only (no $$ plpgsql) so Lovable applies it cleanly. Idempotent.

BEGIN;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS focus_areas text;

COMMIT;
