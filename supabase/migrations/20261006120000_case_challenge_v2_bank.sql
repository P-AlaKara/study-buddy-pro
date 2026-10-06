-- Phase A: replace the active v1 case bank with the two Case Challenge v2 cases.
-- Full action-level definitions live in src/features/case-challenge/cases/ and are
-- validated independently. These rows keep the current v1 player functional until
-- the state-machine player replaces it in Phase B/C.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_slug text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'needs_clinician_review'
    CHECK (review_status IN ('needs_clinician_review', 'clinician_reviewed'));

CREATE UNIQUE INDEX IF NOT EXISTS cases_case_slug_unique
  ON public.cases(case_slug)
  WHERE case_slug IS NOT NULL;

GRANT SELECT (case_slug, review_status) ON public.cases TO anon, authenticated;

-- Dependent v1 attempts, rooms, and weekly challenge rows cascade with their cases.
-- The complete v1 payload remains recoverable under legacy/cases_backup/ via the
-- immutable seed migrations listed there.
DELETE FROM public.cases;

INSERT INTO public.cases (
  id, case_slug, review_status, title, teaser, specialty, organ_system, topic,
  year_level, difficulty, clinical_setting, estimated_minutes, xp_reward, mode,
  is_weekly_challenge, challenge_start, challenge_end, completions_count, patient,
  initial_presentation, history_categories, examinations, investigations,
  interpretation_task, differential_prompt, diagnosis_options, correct_diagnosis,
  correct_differentials, management_options, communication_task, outcomes, debrief,
  answer_key
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'case_001',
  'needs_clinician_review',
  'The Long Flight',
  'Sudden breathlessness after dinner. Is this panic — or something more dangerous?',
  'Emergency & Pulmonology',
  'Respiratory',
  'Pulmonary embolism',
  4,
  'medium',
  'ED',
  20,
  180,
  'both',
  true,
  now(),
  now() + interval '7 days',
  0,
  '{"name":"Amara","age":34,"sex":"Female","location":"ER, 2:47 AM"}'::jsonb,
  'ER, 2:47 AM. A 34-year-old woman is wheeled in by her husband. She was fine at dinner. Now she can barely finish a sentence.',
  '[
    {"category":"The event","questions":[
      {"id":"ask_onset","q":"How did this begin?","a":"It hit me all at once after dinner. The pain is sharp when I breathe in — I feel like I am going to die."},
      {"id":"ask_cough_fever","q":"Any cough, fever, or sputum?","a":"A small dry cough today, but no fever and no phlegm."},
      {"id":"ask_anxiety_history","q":"Have you had panic attacks before?","a":"Work has been stressful, but I have never felt anything like this."}
    ]},
    {"category":"Risk factors","questions":[
      {"id":"ask_travel","q":"Any recent travel or immobility?","a":"I got back from Nairobi three days ago — the flight was nine hours."},
      {"id":"ask_medications","q":"What medicines do you take?","a":"Only my combined contraceptive pill."},
      {"id":"ask_leg_symptoms","q":"Any leg pain or swelling?","a":"My left calf has felt tight since the flight."}
    ]}
  ]'::jsonb,
  '[
    {"id":"check_vitals","name":"Repeat vital signs","finding":"HR 118, BP 108/68, RR 26, SpO2 91% on room air, T 37.1 C."},
    {"id":"examine_lungs","name":"Chest examination","finding":"Equal air entry and clear lungs; inspiration reproduces the pain."},
    {"id":"examine_legs","name":"Examine both legs","finding":"The left calf is subtly swollen and tender along the deep venous system."},
    {"id":"examine_heart","name":"Cardiovascular examination","finding":"Regular tachycardia; normal heart sounds and JVP."}
  ]'::jsonb,
  '[
    {"id":"order_cxr","name":"Chest X-ray","result":"Essentially normal: no focal consolidation, effusion, or pneumothorax."},
    {"id":"order_ecg","name":"12-lead ECG","result":"Sinus tachycardia at 118 bpm; no acute ST elevation."},
    {"id":"order_bloods","name":"D-dimer, troponin, FBC and CRP","result":"D-dimer 3,480 ng/mL FEU; troponin mildly raised; WBC and CRP normal."},
    {"id":"order_abg","name":"Arterial blood gas","result":"Hypoxaemia with respiratory alkalosis."},
    {"id":"order_doppler","name":"Left leg Doppler","result":"Non-compressible popliteal vein with thrombus."},
    {"id":"order_ctpa","name":"CT pulmonary angiogram","result":"Central pulmonary arterial filling defect with bilateral emboli."},
    {"id":"order_abdominal_ultrasound","name":"Abdominal ultrasound","result":"Normal abdominal organs."}
  ]'::jsonb,
  '{"prompt":"The chest X-ray is essentially normal despite hypoxaemia and pleuritic pain. Which diagnosis now needs urgent exclusion?","investigation":"Chest X-ray","options":["Pulmonary embolism","Lobar pneumonia","Panic attack","Pericarditis"]}'::jsonb,
  'Rank your leading hypotheses using all evidence found so far.',
  ARRAY['Pulmonary embolism','Anxiety / panic attack','Community-acquired pneumonia','Spontaneous pneumothorax','Acute coronary syndrome'],
  'Pulmonary embolism',
  ARRAY['Pulmonary embolism','Community-acquired pneumonia','Spontaneous pneumothorax'],
  '[
    {"id":"give_oxygen","label":"Give supplemental oxygen"},
    {"id":"start_monitoring","label":"Start continuous monitoring"},
    {"id":"gain_iv_access","label":"Gain IV access"},
    {"id":"start_anticoagulation","label":"Start therapeutic anticoagulation after probability/bleeding assessment"},
    {"id":"give_thrombolysis","label":"Give systemic thrombolysis despite stable blood pressure"},
    {"id":"give_antibiotics","label":"Start broad-spectrum antibiotics"},
    {"id":"give_anxiolytic","label":"Give an anxiolytic and observe"},
    {"id":"discharge_anxiety","label":"Discharge with presumed anxiety"}
  ]'::jsonb,
  '{"prompt":"Amara asks whether this was all just panic. What do you say?","options":[
    {"id":"explain_pe","text":"The fear was understandable, but your low oxygen and clot risk led us to a pulmonary embolism. We are treating the clot and monitoring you closely."},
    {"id":"blame_anxiety","text":"You made the symptoms worse by panicking."},
    {"id":"false_reassurance","text":"It was harmless and will not happen again."}
  ]}'::jsonb,
  '{"good":"Amara stabilises on oxygen and anticoagulation and is admitted for monitored care.","partial":"The diagnosis is delayed, but she responds once anticoagulation and supportive care begin.","poor":"Untreated embolism causes progressive hypoxaemia and cardiovascular collapse."}'::jsonb,
  '{"summary":"Acute pulmonary embolism arising from a left lower-limb DVT after long-haul travel and combined hormonal contraception.","teaching_points":["Use clinical probability to guide D-dimer and imaging.","A normal chest X-ray does not rule out PE.","Ask about travel, immobility, hormones, and calf symptoms; anxiety is a diagnosis of exclusion."],"pitfalls":["Anchoring on panic because the patient is frightened.","Ordering every test while delaying oxygen, monitoring, and focused PE work-up."]}'::jsonb,
  '{"key_history":["ask_travel","ask_medications","ask_leg_symptoms"],"key_exams":["check_vitals","examine_legs"],"key_investigations":["order_cxr","order_bloods","order_ctpa"],"unnecessary_investigations":["order_abdominal_ultrasound"],"interpretation":"Pulmonary embolism","management_correct":["give_oxygen","start_monitoring","gain_iv_access","start_anticoagulation"],"management_harmful":["give_thrombolysis","give_antibiotics","give_anxiolytic","discharge_anxiety"],"communication_best":"explain_pe"}'::jsonb
), (
  'a1000000-0000-4000-8000-000000000002',
  'case_002',
  'needs_clinician_review',
  'The Tearing Pain',
  'A sudden catastrophic chest pain looks like MI — but the standard MI treatment could be fatal.',
  'Emergency, Cardiology & Cardiothoracic Surgery',
  'Cardiovascular',
  'Acute aortic dissection',
  5,
  'hard',
  'ED',
  22,
  220,
  'both',
  false,
  null,
  null,
  0,
  '{"name":"Daniel","age":58,"sex":"Male","location":"ER, 6:12 PM"}'::jsonb,
  'ER, 6:12 PM. A 58-year-old man grips the trolley rail, drenched in sweat. The chest pain struck without warning and now tears through to his back.',
  '[
    {"category":"The pain","questions":[
      {"id":"ask_pain_character","q":"Describe the pain and exactly how it began.","a":"It was instant — the worst pain of my life. It tears from my chest between my shoulder blades."},
      {"id":"ask_acs_features","q":"Any sweating, nausea, or heavy pressure?","a":"I am sweating and nauseated, but it is tearing, not heavy."},
      {"id":"ask_reflux","q":"Is this like your usual reflux?","a":"Nothing like it. Antacid did not touch it."}
    ]},
    {"category":"Vascular risk","questions":[
      {"id":"ask_hypertension","q":"Do you have high blood pressure?","a":"For years. I ran out of tablets two months ago."},
      {"id":"ask_neurologic_symptoms","q":"Any weakness, numbness, or fainting?","a":"My left hand went numb in the ambulance and I nearly blacked out."}
    ]}
  ]'::jsonb,
  '[
    {"id":"check_vitals","name":"Initial vital signs","finding":"HR 112, right-arm BP 198/112, RR 24, SpO2 96%, T 36.7 C."},
    {"id":"check_both_arm_bp","name":"Blood pressure in both arms","finding":"Right 198/112; left 164/96 — 34 mmHg systolic difference."},
    {"id":"auscultate_heart","name":"Cardiac auscultation","finding":"New high-pitched early diastolic murmur at the left sternal edge."},
    {"id":"check_pulses","name":"Compare pulses","finding":"Left radial pulse is weaker and delayed."}
  ]'::jsonb,
  '[
    {"id":"order_ecg","name":"12-lead ECG","result":"Sinus tachycardia, LVH, non-specific ST-T changes; no diagnostic STEMI."},
    {"id":"order_troponin","name":"Troponin and baseline bloods","result":"Troponin mildly raised at 42 ng/L; lactate 2.6 mmol/L."},
    {"id":"order_cxr","name":"Portable chest X-ray","result":"Widened mediastinum and abnormal aortic contour."},
    {"id":"order_ct_aorta","name":"CT aortic angiogram","result":"Intimal flap from ascending aorta through the arch: Stanford type A dissection."},
    {"id":"order_bedside_echo","name":"Bedside echocardiogram","result":"Dilated aortic root, moderate aortic regurgitation, small pericardial effusion."},
    {"id":"order_d_dimer","name":"D-dimer","result":"Elevated but non-specific."},
    {"id":"order_coronary_angiography","name":"Direct coronary angiography","result":"Transfer delays aortic imaging while pulse deficit worsens."}
  ]'::jsonb,
  '{"prompt":"The ECG is not diagnostic for STEMI and the chest X-ray shows a widened mediastinum. What diagnosis best connects the findings?","investigation":"Chest X-ray","options":["Acute aortic dissection","ST-elevation myocardial infarction","Acid reflux","Pulmonary embolism"]}'::jsonb,
  'Rank your leading hypotheses before giving any treatment that could worsen bleeding.',
  ARRAY['Acute aortic dissection','Acute coronary syndrome / STEMI','Gastro-oesophageal reflux','Pulmonary embolism','Acute pericarditis'],
  'Acute aortic dissection',
  ARRAY['Acute aortic dissection','Acute coronary syndrome / STEMI','Pulmonary embolism'],
  '[
    {"id":"start_monitoring","label":"Start continuous monitoring"},
    {"id":"gain_iv_access","label":"Gain two large-bore IV lines"},
    {"id":"give_opioid_analgesia","label":"Give titrated IV opioid analgesia"},
    {"id":"give_beta_blocker","label":"Start IV beta-blockade"},
    {"id":"call_cardiothoracic_surgery","label":"Call cardiothoracic surgery urgently"},
    {"id":"give_vasodilator_alone","label":"Start a vasodilator before beta-blockade"},
    {"id":"give_acs_antithrombotics","label":"Give aspirin and therapeutic heparin"},
    {"id":"give_thrombolysis","label":"Give thrombolysis for presumed STEMI"},
    {"id":"give_ppi","label":"Give antacid and observe"}
  ]'::jsonb,
  '{"prompt":"Daniel asks why he is going to surgery instead of the catheter lab. What do you say?","options":[
    {"id":"explain_dissection","text":"There is a tear in the first part of your aorta. We are reducing the force on it now, and emergency surgery is the safest definitive treatment."},
    {"id":"say_heart_attack","text":"It is definitely a heart attack, but surgery is quicker."},
    {"id":"minimise","text":"It is probably nothing serious; this is routine."}
  ]}'::jsonb,
  '{"good":"Impulse control is achieved and Daniel reaches emergency repair before rupture.","partial":"Recognition is delayed, but the surgical team repairs the type A dissection after stabilisation.","poor":"The untreated or inappropriately anticoagulated dissection ruptures, causing shock and arrest."}'::jsonb,
  '{"summary":"Acute Stanford type A aortic dissection with aortic regurgitation in uncontrolled hypertension.","teaching_points":["Look for abrupt maximal pain, pulse or pressure asymmetry, and a new aortic regurgitation murmur.","Use IV beta-blockade first to reduce aortic shear.","Type A dissection needs urgent surgery; antithrombotics or thrombolysis can be fatal."],"pitfalls":["Anchoring on MI because troponin is mildly raised.","Giving anticoagulation or thrombolysis before considering dissection red flags."]}'::jsonb,
  '{"key_history":["ask_pain_character","ask_hypertension","ask_neurologic_symptoms"],"key_exams":["check_both_arm_bp","auscultate_heart","check_pulses"],"key_investigations":["order_ecg","order_cxr","order_ct_aorta"],"unnecessary_investigations":["order_d_dimer","order_coronary_angiography"],"interpretation":"Acute aortic dissection","management_correct":["start_monitoring","gain_iv_access","give_opioid_analgesia","give_beta_blocker","call_cardiothoracic_surgery"],"management_harmful":["give_vasodilator_alone","give_acs_antithrombotics","give_thrombolysis","give_ppi"],"communication_best":"explain_dissection"}'::jsonb
);

INSERT INTO public.weekly_challenges (case_id, starts_at, ends_at, rules)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  now(),
  now() + interval '7 days',
  ARRAY[
    'Work the case in any action order.',
    'Hints cost points after the first tier.',
    'Accuracy ranks first; efficiency breaks ties.'
  ]
);
