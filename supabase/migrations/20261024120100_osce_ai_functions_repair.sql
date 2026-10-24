-- The 20261023213000_osce_free_form migration created the osce_ai_* tables but
-- its three plpgsql functions never landed in the database: calling them from
-- the server returns PostgREST PGRST202 ("Could not find the function ... in the
-- schema cache"), which the OSCE screen surfaces as "That action was not saved.
-- The consultation changed or another interaction is already being saved." for
-- every action -- guided and free-form alike. Re-declare the functions here with
-- CREATE OR REPLACE so applying this migration repairs any environment where the
-- functions are missing (and is a no-op where they already exist). Definitions
-- are identical to the originating migration.

-- Serialises every mutation for a session. A stale lock can be reclaimed after
-- a provider/runtime failure so a session cannot remain permanently wedged.
CREATE OR REPLACE FUNCTION public.acquire_osce_ai_request(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_request_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean;
BEGIN
  UPDATE public.osce_ai_sessions
  SET inflight_request_id = p_request_id
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND revision = p_expected_revision
    AND (
      inflight_request_id IS NULL
      OR inflight_request_id = p_request_id
      OR updated_at < now() - interval '45 seconds'
    )
  RETURNING true INTO acquired;

  RETURN COALESCE(acquired, false);
END;
$$;

-- Enforces both provider-call limits under database locks, including calls
-- made concurrently from different sessions belonging to the same user.
CREATE OR REPLACE FUNCTION public.reserve_osce_ai_call(
  p_session_id uuid,
  p_user_id uuid,
  p_call_kind text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_count integer;
  hourly_count integer;
BEGIN
  IF p_call_kind NOT IN ('interaction', 'nudge', 'feedback') THEN
    RAISE EXCEPTION 'invalid_call_kind';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT llm_call_count INTO session_count
  FROM public.osce_ai_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF session_count >= 50 THEN RAISE EXCEPTION 'session_call_limit'; END IF;

  SELECT count(*)::integer INTO hourly_count
  FROM public.osce_ai_usage
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '1 hour';

  IF hourly_count >= 120 THEN RAISE EXCEPTION 'hourly_call_limit'; END IF;

  INSERT INTO public.osce_ai_usage(user_id, session_id, call_kind)
  VALUES (p_user_id, p_session_id, p_call_kind);

  UPDATE public.osce_ai_sessions
  SET llm_call_count = llm_call_count + 1
  WHERE id = p_session_id AND user_id = p_user_id
  RETURNING llm_call_count INTO session_count;

  RETURN session_count;
END;
$$;

-- Commits an authoritative engine revision and its ordered interaction in one
-- transaction. The interaction upsert also completes a previously persisted
-- pending Free-form input without creating duplicate credit.
CREATE OR REPLACE FUNCTION public.commit_osce_ai_state(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_request_id uuid,
  p_engine_state jsonb,
  p_interaction jsonb,
  p_ai_used boolean DEFAULT false,
  p_complete boolean DEFAULT false,
  p_final_result jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_revision integer;
BEGIN
  UPDATE public.osce_ai_sessions
  SET
    engine_state = p_engine_state,
    revision = revision + 1,
    ai_used = ai_used OR p_ai_used,
    inflight_request_id = NULL,
    status = CASE WHEN p_complete THEN 'complete' ELSE status END,
    final_result = CASE WHEN p_complete THEN p_final_result ELSE final_result END,
    ended_at = CASE WHEN p_complete THEN COALESCE(ended_at, now()) ELSE ended_at END
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND revision = p_expected_revision
    AND inflight_request_id = p_request_id
  RETURNING revision INTO next_revision;

  IF next_revision IS NULL THEN
    RAISE EXCEPTION 'revision_or_lock_conflict' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.osce_ai_interactions (
    session_id,
    client_request_id,
    sequence,
    source_mode,
    input_kind,
    student_text,
    patient_response,
    interaction_rating,
    avatar_expression,
    matched_card_ids,
    facts_disclosed,
    objectives_satisfied,
    objectives_penalised,
    cue_pickups,
    curveball_response_card_id,
    evaluation_reason,
    time_cost_seconds,
    elapsed_second,
    status,
    error_code
  ) VALUES (
    p_session_id,
    p_request_id,
    (p_interaction->>'sequence')::integer,
    p_interaction->>'sourceMode',
    NULLIF(p_interaction->>'inputKind', ''),
    COALESCE(p_interaction->>'studentText', ''),
    COALESCE(p_interaction->>'patientResponse', ''),
    NULLIF(p_interaction->>'interactionRating', ''),
    NULLIF(p_interaction->>'avatarExpression', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'matchedCardIds', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'factsDisclosed', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'objectivesSatisfied', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'objectivesPenalised', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_interaction->'cuePickups', '[]'::jsonb))),
    NULLIF(p_interaction->>'curveballResponseCardId', ''),
    NULLIF(p_interaction->>'evaluationReason', ''),
    COALESCE((p_interaction->>'timeCostSeconds')::integer, 0),
    COALESCE((p_interaction->>'elapsedSecond')::integer, 0),
    COALESCE(NULLIF(p_interaction->>'status', ''), 'complete'),
    NULLIF(p_interaction->>'errorCode', '')
  )
  ON CONFLICT (session_id, client_request_id) DO UPDATE SET
    sequence = EXCLUDED.sequence,
    source_mode = EXCLUDED.source_mode,
    input_kind = EXCLUDED.input_kind,
    student_text = EXCLUDED.student_text,
    patient_response = EXCLUDED.patient_response,
    interaction_rating = EXCLUDED.interaction_rating,
    avatar_expression = EXCLUDED.avatar_expression,
    matched_card_ids = EXCLUDED.matched_card_ids,
    facts_disclosed = EXCLUDED.facts_disclosed,
    objectives_satisfied = EXCLUDED.objectives_satisfied,
    objectives_penalised = EXCLUDED.objectives_penalised,
    cue_pickups = EXCLUDED.cue_pickups,
    curveball_response_card_id = EXCLUDED.curveball_response_card_id,
    evaluation_reason = EXCLUDED.evaluation_reason,
    time_cost_seconds = EXCLUDED.time_cost_seconds,
    elapsed_second = EXCLUDED.elapsed_second,
    status = EXCLUDED.status,
    error_code = EXCLUDED.error_code;

  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_osce_ai_request(uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_osce_ai_call(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_osce_ai_state(uuid, uuid, integer, uuid, jsonb, jsonb, boolean, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_osce_ai_request(uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_osce_ai_call(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_osce_ai_state(uuid, uuid, integer, uuid, jsonb, jsonb, boolean, boolean, jsonb) TO service_role;

-- Ask PostgREST to refresh its schema cache so the new functions are callable
-- immediately over the REST/RPC interface.
NOTIFY pgrst, 'reload schema';
