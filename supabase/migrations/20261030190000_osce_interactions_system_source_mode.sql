-- The 20261023213000_osce_free_form migration declares osce_ai_interactions
-- with `source_mode IN ('guided', 'free_form', 'nudge', 'system')`, but the
-- constraint that actually landed on the connected (Lovable) database predates
-- the 'system' value and only allows ('guided', 'free_form', 'nudge') -- the
-- same partial-apply drift that left the osce_ai_* RPCs missing until the
-- 20261024120100 repair.
--
-- Ending a consultation (endOsceAiConsultation) and answering examiner
-- questions (answerOsceAiExaminerQuestion) both commit an interaction with
-- source_mode = 'system'. That INSERT violates the stale check constraint, so
-- the whole commit_osce_ai_state transaction rolls back: the revision never
-- advances, no interaction row is written, and the server surfaces the generic
-- "The consultation changed before it could be saved." Guided, Free-form and
-- nudge actions are unaffected because their source_mode values are allowed.
--
-- Re-declare the constraint so it matches the authored schema. Idempotent:
-- a no-op where 'system' is already permitted.
ALTER TABLE public.osce_ai_interactions
  DROP CONSTRAINT IF EXISTS osce_ai_interactions_source_mode_check;

ALTER TABLE public.osce_ai_interactions
  ADD CONSTRAINT osce_ai_interactions_source_mode_check
  CHECK (source_mode IN ('guided', 'free_form', 'nudge', 'system'));
