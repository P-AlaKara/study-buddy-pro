-- Both launch demo cases have completed clinician review.
UPDATE public.cases
SET review_status = 'clinician_reviewed'
WHERE case_slug IN ('case_001', 'case_002');
