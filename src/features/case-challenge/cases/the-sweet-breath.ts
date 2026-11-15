import type { MedicalCase, ResultCondition } from "../schema.js";

/*
 * Patient states the responses track:
 * - DRY: no IV fluids by minute 10; he is sliding into hypovolaemic shock
 *   (tachycardia, falling pressure, deeper breathing, drowsier).
 * - ACIDOTIC: fluids are running but there is still no insulin by minute 25;
 *   ketone production continues and the acidosis deepens.
 * - RESUSCITATED: IV fluids have been started.
 * - ON_INSULIN: the fixed-rate insulin infusion is running.
 */
const DRY: ResultCondition = { afterDeterioration: ["dka_no_fluids"] };
const ACIDOTIC: ResultCondition = { afterDeterioration: ["dka_no_insulin"] };
const RESUSCITATED: ResultCondition = { afterActions: ["start_iv_fluids"] };
const ON_INSULIN: ResultCondition = { afterActions: ["start_insulin_infusion"] };

export const theSweetBreath: MedicalCase = {
  id: "a1000000-0000-4000-8000-000000000003",
  slug: "case_003",
  title: "The Sweet Breath",
  difficulty: 2,
  specialty: ["Emergency", "Endocrinology", "Internal Medicine"],
  setting: "ER, 11:20 PM",
  intro:
    "ER, 11:20 PM. A 19-year-old student is brought in by his roommate after a day of vomiting and stomach cramps. He is drowsy, breathing deep and fast, and asking for water.",
  reviewStatus: "needs_clinician_review",
  patient: {
    name: "Jean-Paul",
    age: 19,
    sex: "Male",
    avatar: {
      skinTone: "deep_brown",
      hair: "short_black",
      outfit: "grey_hoodie",
      ageCues: "young_adult",
    },
    personality:
      "Polite and a little embarrassed; answers slowly, drifting off mid-sentence, and keeps asking for a drink.",
    chiefComplaint: "Vomiting, abdominal cramps and drowsiness for a day.",
    presentingTags: ["Vomiting", "Abdominal pain", "Drowsy", "Very thirsty"],
    initialExpression: "drowsy",
  },
  vitalsTimeline: [
    { tMinute: 0, hr: 118, bp: "104/66", rr: 28, spo2: 98, temp: 37.2 },
    { tMinute: 10, hr: 134, bp: "88/56", rr: 32, spo2: 98, temp: 37.1 },
    { tMinute: 30, hr: 148, bp: "72/44", rr: 36, spo2: 96, temp: 36.8 },
  ],
  deteriorationRules: [
    {
      id: "dka_no_fluids",
      ifNotDoneBy: 10,
      action: "start_iv_fluids",
      effect: { hr: 16, systolicBp: -16, diastolicBp: -10, rr: 4 },
      alertLine:
        "Doctor, his pressure is down to 88 and he's hard to rouse — he still hasn't had any fluid.",
      source: "nurse",
      triggersEvent: "hypovolaemia_worsens",
      lossAtMinute: 30,
    },
    {
      id: "dka_no_insulin",
      ifNotDoneBy: 25,
      action: "start_insulin_infusion",
      effect: { hr: 8, rr: 4, spo2: -1 },
      alertLine:
        "He's breathing even deeper now and the ketones on the meter just read 'HI'. Are we starting insulin?",
      source: "nurse",
      triggersEvent: "ketoacidosis_deepens",
      lossAtMinute: 45,
    },
  ],
  actions: [
    {
      id: "ask_onset",
      category: "ask",
      label: "Ask how this began",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "It started yesterday… cramps all over my stomach, then I couldn't stop vomiting. I thought it was something I ate.",
      },
      variants: [
        {
          when: DRY,
          result: { content: "Yesterday… cramps, then vomiting. So thirsty. Can I have water?" },
        },
      ],
      clueTier: "obvious",
      supports: ["gastroenteritis", "diabetic_ketoacidosis"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "ask_thirst_urination",
      category: "ask",
      label: "Ask about thirst and passing urine",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "For two weeks I've been drinking litres of water and still thirsty. I'm up four or five times a night to pee — I thought it was the heat.",
      },
      variants: [
        {
          when: DRY,
          result: {
            content: "Weeks… drinking all the time… peeing all night. Still thirsty. Please.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis", "hyperosmolar_hyperglycaemic_state"],
      against: ["gastroenteritis", "appendicitis"],
      triggersEvent: "osmotic_symptoms_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_weight_loss",
      category: "ask",
      label: "Ask about weight and energy",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "My trousers have gone loose — maybe five kilos since the start of term. I've been exhausted, falling asleep in lectures.",
      },
      variants: [
        {
          when: DRY,
          result: { content: "Lost weight… trousers loose. So tired… all term." },
        },
      ],
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis"],
      against: ["gastroenteritis", "appendicitis"],
      triggersEvent: "weight_loss_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_sick_contacts",
      category: "ask",
      label: "Ask about food and sick contacts",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "We had street brochettes two nights ago, and my roommate had a stomach bug last week. That's why I thought it was food poisoning.",
      },
      variants: [
        {
          when: DRY,
          result: { content: "Brochettes… two nights ago. Roommate had a bug… last week." },
        },
      ],
      clueTier: "red_herring",
      supports: ["gastroenteritis"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "ask_medical_history",
      category: "ask",
      label: "Ask about past illness and family history",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I've never been ill, never seen a doctor for anything. My aunt has 'sugar diabetes' — she injects insulin every day.",
      },
      variants: [
        {
          when: DRY,
          result: { content: "Never ill before. My aunt… has sugar. She injects." },
        },
      ],
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis"],
      against: [],
      triggersEvent: "family_history_revealed",
    },
    {
      id: "ask_alcohol_drugs",
      category: "ask",
      label: "Ask about alcohol and drugs",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content: "A beer at the weekend sometimes. Nothing else, I promise.",
      },
      clueTier: "none",
      supports: [],
      against: ["acute_pancreatitis"],
      triggersEvent: "",
    },
    {
      id: "check_vitals",
      category: "examine",
      label: "Check vital signs",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "HR {hr}, BP {bp}, RR {rr} with deep, sighing breaths, SpO₂ {spo2}% on room air, temperature {temp}°C. He is drowsy but rousable to voice.",
      },
      variants: [
        {
          when: DRY,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. He is now difficult to rouse, with cold mottled hands and a thready pulse — hypovolaemic shock.",
          },
        },
        {
          when: { afterActions: ["start_iv_fluids", "start_insulin_infusion"] },
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. With fluids and insulin running his breathing is slowing and he is more awake, asking what happened.",
          },
        },
        {
          when: RESUSCITATED,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}%, temperature {temp}°C. The fluid bolus has lifted his pressure, but the deep sighing breathing continues.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["diabetic_ketoacidosis", "gastroenteritis"],
      against: [],
      triggersEvent: "",
      isCritical: true,
    },
    {
      id: "examine_breathing",
      category: "examine",
      label: "Observe his breathing and smell his breath",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Deep, regular, sighing respirations at {rr} breaths per minute (Kussmaul breathing) with clear lungs. His breath has a sweet, pear-drop smell.",
      },
      variants: [
        {
          when: ACIDOTIC,
          result: {
            content:
              "The Kussmaul breathing is deeper still at {rr} breaths per minute and he is tiring with the effort. The pear-drop smell fills the cubicle.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis"],
      against: ["gastroenteritis", "appendicitis", "hyperosmolar_hyperglycaemic_state"],
      triggersEvent: "kussmaul_breathing_found",
      isKeyClue: true,
    },
    {
      id: "examine_hydration",
      category: "examine",
      label: "Assess hydration",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Dry, cracked lips and a dry tongue; reduced skin turgor; sunken eyes. Capillary refill is 3 seconds. He is profoundly dehydrated.",
      },
      variants: [
        {
          when: RESUSCITATED,
          result: {
            content:
              "Mucous membranes are still dry but capillary refill is back under 2 seconds after the first litre of fluid.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["diabetic_ketoacidosis", "gastroenteritis", "hyperosmolar_hyperglycaemic_state"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "examine_abdomen",
      category: "examine",
      label: "Examine the abdomen",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Mild, diffuse tenderness without guarding or rebound. No tenderness at McBurney's point, bowel sounds are present and there is no organomegaly. The abdominal pain is out of proportion to any surgical sign.",
      },
      clueTier: "contradicting",
      supports: ["diabetic_ketoacidosis"],
      against: ["appendicitis", "acute_pancreatitis"],
      triggersEvent: "benign_abdomen_found",
    },
    {
      id: "examine_mental_state",
      category: "examine",
      label: "Assess conscious level",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "GCS 14 (eyes open to voice). He is orientated but slow, with no focal neurological deficit and no neck stiffness.",
      },
      variants: [
        {
          when: DRY,
          result: {
            content:
              "GCS 12: eyes open only to voice, confused speech, localising to pain. No focal deficit, no neck stiffness.",
          },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "",
    },
    {
      id: "bedside_glucose",
      category: "test",
      label: "Finger-prick glucose and ketones",
      timeCostMin: 1,
      moneyCost: 5,
      riskNote: "",
      result: {
        type: "lab_table",
        content: "Capillary glucose is markedly raised and blood ketones are high.",
        labs: [
          {
            test: "Capillary glucose",
            result: "28.4 mmol/L",
            reference: "4.0–7.8",
            flag: "critical",
          },
          { test: "Capillary ketones", result: "5.8 mmol/L", reference: "<0.6", flag: "critical" },
        ],
      },
      variants: [
        {
          when: ON_INSULIN,
          result: {
            content:
              "Glucose is falling on the insulin infusion and ketones are starting to clear.",
            labs: [
              {
                test: "Capillary glucose",
                result: "19.6 mmol/L",
                reference: "4.0–7.8",
                flag: "high",
              },
              { test: "Capillary ketones", result: "3.9 mmol/L", reference: "<0.6", flag: "high" },
            ],
          },
        },
      ],
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis", "hyperosmolar_hyperglycaemic_state"],
      against: ["gastroenteritis", "appendicitis"],
      triggersEvent: "hyperglycaemia_found",
      isKeyClue: true,
    },
    {
      id: "order_vbg",
      category: "test",
      label: "Venous blood gas",
      timeCostMin: 3,
      moneyCost: 40,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "Severe metabolic acidosis with a high anion gap and respiratory compensation. Potassium is high-normal despite total-body depletion.",
        labs: [
          { test: "pH", result: "7.08", reference: "7.35–7.45", flag: "critical" },
          { test: "Bicarbonate", result: "7 mmol/L", reference: "22–28", flag: "critical" },
          { test: "PvCO₂", result: "2.6 kPa", reference: "5.3–6.8", flag: "low" },
          { test: "Potassium", result: "5.4 mmol/L", reference: "3.5–5.0", flag: "high" },
          { test: "Lactate", result: "1.9 mmol/L", reference: "0.5–2.2", flag: "normal" },
        ],
      },
      variants: [
        {
          when: ACIDOTIC,
          result: {
            content:
              "The acidosis is deepening without insulin: bicarbonate is falling and potassium is climbing.",
            labs: [
              { test: "pH", result: "6.98", reference: "7.35–7.45", flag: "critical" },
              { test: "Bicarbonate", result: "4 mmol/L", reference: "22–28", flag: "critical" },
              { test: "PvCO₂", result: "2.1 kPa", reference: "5.3–6.8", flag: "low" },
              { test: "Potassium", result: "5.9 mmol/L", reference: "3.5–5.0", flag: "critical" },
              { test: "Lactate", result: "2.4 mmol/L", reference: "0.5–2.2", flag: "high" },
            ],
          },
        },
        {
          when: ON_INSULIN,
          result: {
            content:
              "The acidosis is beginning to correct on treatment. Potassium has dropped sharply now that insulin is driving it into cells.",
            labs: [
              { test: "pH", result: "7.18", reference: "7.35–7.45", flag: "critical" },
              { test: "Bicarbonate", result: "11 mmol/L", reference: "22–28", flag: "low" },
              { test: "PvCO₂", result: "3.1 kPa", reference: "5.3–6.8", flag: "low" },
              { test: "Potassium", result: "3.6 mmol/L", reference: "3.5–5.0", flag: "normal" },
              { test: "Lactate", result: "1.6 mmol/L", reference: "0.5–2.2", flag: "normal" },
            ],
          },
        },
        {
          when: DRY,
          result: {
            content:
              "Severe high anion gap metabolic acidosis; lactate is now rising with poor perfusion.",
            labs: [
              { test: "pH", result: "7.02", reference: "7.35–7.45", flag: "critical" },
              { test: "Bicarbonate", result: "5 mmol/L", reference: "22–28", flag: "critical" },
              { test: "PvCO₂", result: "2.3 kPa", reference: "5.3–6.8", flag: "low" },
              { test: "Potassium", result: "5.7 mmol/L", reference: "3.5–5.0", flag: "critical" },
              { test: "Lactate", result: "3.4 mmol/L", reference: "0.5–2.2", flag: "high" },
            ],
          },
        },
      ],
      clueTier: "contradicting",
      supports: ["diabetic_ketoacidosis"],
      against: ["gastroenteritis", "hyperosmolar_hyperglycaemic_state"],
      triggersEvent: "acidosis_confirmed",
      isKeyClue: true,
    },
    {
      id: "urine_dipstick",
      category: "test",
      label: "Urine dipstick",
      timeCostMin: 2,
      moneyCost: 10,
      riskNote: "",
      result: {
        type: "lab_table",
        content: "Heavy glycosuria and ketonuria; no blood, protein, nitrites or leucocytes.",
        labs: [
          { test: "Glucose", result: "4+", reference: "Negative", flag: "high" },
          { test: "Ketones", result: "4+", reference: "Negative", flag: "high" },
          {
            test: "Leucocytes / nitrites",
            result: "Negative",
            reference: "Negative",
            flag: "normal",
          },
        ],
      },
      clueTier: "buried",
      supports: ["diabetic_ketoacidosis"],
      against: ["gastroenteritis", "hyperosmolar_hyperglycaemic_state"],
      triggersEvent: "ketonuria_found",
      isKeyClue: true,
    },
    {
      id: "order_bloods",
      category: "test",
      label: "U&E, FBC, amylase and CRP",
      timeCostMin: 6,
      moneyCost: 110,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "Pre-renal kidney injury with a borderline-high potassium. The white count is raised without a raised CRP (stress leucocytosis); amylase is normal.",
        labs: [
          { test: "Sodium", result: "131 mmol/L", reference: "135–145", flag: "low" },
          { test: "Potassium", result: "5.4 mmol/L", reference: "3.5–5.0", flag: "high" },
          { test: "Urea", result: "14.2 mmol/L", reference: "2.5–7.8", flag: "high" },
          { test: "Creatinine", result: "138 µmol/L", reference: "60–110", flag: "high" },
          { test: "WBC", result: "15.6 ×10⁹/L", reference: "4.0–11.0", flag: "high" },
          { test: "CRP", result: "6 mg/L", reference: "<5", flag: "normal" },
          { test: "Amylase", result: "62 U/L", reference: "28–100", flag: "normal" },
        ],
      },
      variants: [
        {
          when: ON_INSULIN,
          result: {
            content:
              "Pre-renal kidney injury; potassium has fallen into the normal range on insulin and will keep falling without replacement. Amylase is normal.",
            labs: [
              { test: "Sodium", result: "133 mmol/L", reference: "135–145", flag: "low" },
              { test: "Potassium", result: "3.7 mmol/L", reference: "3.5–5.0", flag: "normal" },
              { test: "Urea", result: "13.1 mmol/L", reference: "2.5–7.8", flag: "high" },
              { test: "Creatinine", result: "126 µmol/L", reference: "60–110", flag: "high" },
              { test: "WBC", result: "14.8 ×10⁹/L", reference: "4.0–11.0", flag: "high" },
              { test: "CRP", result: "6 mg/L", reference: "<5", flag: "normal" },
              { test: "Amylase", result: "60 U/L", reference: "28–100", flag: "normal" },
            ],
          },
        },
      ],
      clueTier: "obvious",
      supports: ["diabetic_ketoacidosis"],
      against: ["acute_pancreatitis"],
      triggersEvent: "",
    },
    {
      id: "order_ecg",
      category: "test",
      label: "12-lead ECG",
      timeCostMin: 3,
      moneyCost: 45,
      riskNote: "",
      result: {
        type: "ecg",
        content:
          "{rhythm} at {hr} bpm. Normal intervals, no peaked T waves and no ST change — no ECG evidence of dangerous hyperkalaemia yet.",
        ecg: { preset: "sinus_normal" },
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "",
    },
    {
      id: "order_abdominal_ultrasound",
      category: "test",
      label: "Abdominal ultrasound",
      timeCostMin: 15,
      moneyCost: 160,
      riskNote: "No direct harm, but delays resuscitation.",
      result: {
        type: "text",
        content:
          "Normal appendix, liver, pancreas and kidneys. No free fluid. Fifteen minutes in radiology while he remains untreated.",
      },
      clueTier: "red_herring",
      supports: [],
      against: ["appendicitis", "acute_pancreatitis"],
      triggersEvent: "",
      isUnnecessary: true,
    },
    {
      id: "order_ct_abdomen",
      category: "test",
      label: "CT abdomen with contrast",
      timeCostMin: 20,
      moneyCost: 420,
      riskNote: "Ionising radiation and contrast load in a dehydrated patient with kidney injury.",
      result: {
        type: "text",
        content:
          "No surgical pathology. The contrast load adds to his kidney injury, and twenty minutes pass without treatment.",
      },
      clueTier: "none",
      supports: [],
      against: ["appendicitis", "acute_pancreatitis"],
      triggersEvent: "ct_delay",
      isUnnecessary: true,
    },
    {
      id: "start_monitoring",
      category: "treat",
      label: "Start continuous monitoring",
      timeCostMin: 1,
      moneyCost: 10,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Continuous ECG, pulse oximetry and frequent blood pressure monitoring are started. The monitor shows {rhythm} at {hr} bpm, BP {bp}, SpO₂ {spo2}%.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "monitoring_started",
      isCritical: true,
    },
    {
      id: "gain_iv_access",
      category: "treat",
      label: "Gain two IV lines",
      timeCostMin: 2,
      moneyCost: 20,
      riskNote: "Minor cannulation risks.",
      result: {
        type: "text",
        content:
          "Two large-bore cannulas are secured despite collapsed veins; blood samples are drawn.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "iv_access_ready",
      isCritical: true,
    },
    {
      id: "start_iv_fluids",
      category: "treat",
      label: "Start IV fluid resuscitation",
      timeCostMin: 2,
      moneyCost: 25,
      riskNote: "Reassess after each bolus; avoid over-rapid correction in young patients.",
      result: {
        type: "text",
        content:
          "A litre of 0.9% saline runs in over the first hour. His pulse settles to {hr} and pressure improves to {bp}; he manages a few clearer words.",
      },
      variants: [
        {
          when: DRY,
          result: {
            content:
              "A rapid litre of 0.9% saline is followed by a second. The pressure recovers to {bp} and he opens his eyes to voice — but he needed this half an hour ago.",
          },
          vitalsEffect: { hr: -14, systolicBp: 14, diastolicBp: 8 },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "fluids_started",
      isCritical: true,
      vitalsEffect: { hr: -12, systolicBp: 10, diastolicBp: 6 },
    },
    {
      id: "replace_potassium",
      category: "treat",
      label: "Add potassium to the fluids",
      timeCostMin: 2,
      moneyCost: 15,
      riskNote: "Guide replacement by the measured potassium and ECG.",
      result: {
        type: "text",
        content:
          "Potassium chloride is added to the next bag at a rate guided by the measured level, with repeat checks planned every two hours.",
      },
      clueTier: "none",
      supports: ["diabetic_ketoacidosis"],
      against: [],
      triggersEvent: "potassium_replacement_started",
      penalizeWhenUnsafe: true,
      safeWhen: {
        anyActionIds: ["order_vbg", "order_bloods"],
        explanation:
          "Replace potassium only once the level is known: it is often high at first, then falls fast once insulin starts.",
      },
    },
    {
      id: "start_insulin_infusion",
      category: "treat",
      label: "Start a fixed-rate insulin infusion",
      timeCostMin: 2,
      moneyCost: 40,
      riskNote:
        "Insulin drives potassium into cells; check the level and have fluids running first.",
      result: {
        type: "text",
        content:
          "A fixed-rate IV insulin infusion (0.1 units/kg/hour) is started with the fluids running. Hourly glucose, ketone and potassium checks are set up.",
      },
      variants: [
        {
          when: ACIDOTIC,
          result: {
            content:
              "A fixed-rate IV insulin infusion is finally started. Ketone production will now switch off, but the acidosis was allowed to deepen for too long.",
          },
        },
      ],
      clueTier: "none",
      supports: ["diabetic_ketoacidosis"],
      against: [],
      triggersEvent: "insulin_started",
      isCritical: true,
      penalizeWhenUnsafe: true,
      vitalsEffect: { rr: -3, hr: -4 },
      safeWhen: {
        allActionIds: ["start_iv_fluids"],
        anyActionIds: ["order_vbg", "order_bloods"],
        explanation:
          "Start insulin only after fluids are running and the potassium is known. Insulin given first drops the potassium and the circulating volume together, risking arrhythmia.",
      },
    },
    {
      id: "give_antiemetic",
      category: "treat",
      label: "Give an IV antiemetic",
      timeCostMin: 1,
      moneyCost: 12,
      riskNote: "",
      result: {
        type: "text",
        content: "IV ondansetron settles the vomiting. It does nothing for the cause.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "",
    },
    {
      id: "give_bicarbonate",
      category: "treat",
      label: "Give IV sodium bicarbonate",
      timeCostMin: 2,
      moneyCost: 30,
      riskNote: "No proven benefit in DKA; worsens hypokalaemia and risks cerebral oedema.",
      result: {
        type: "text",
        content:
          "Bicarbonate is pushed to 'fix the pH'. His potassium drops further and the sodium load adds to the osmotic stress on his brain — with no faster recovery of the acidosis.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "bicarbonate_harm",
      harmful: true,
    },
    {
      id: "give_oral_rehydration_only",
      category: "treat",
      label: "Oral rehydration and observe",
      timeCostMin: 10,
      moneyCost: 5,
      riskNote: "Dangerous delay in a shocked, vomiting patient.",
      result: {
        type: "text",
        content:
          "He vomits the oral rehydration solution within minutes. Ten minutes pass without IV fluid while his pressure drifts down to {bp}.",
      },
      clueTier: "none",
      supports: ["gastroenteritis"],
      against: [],
      triggersEvent: "oral_fluids_fail",
      harmful: true,
      vitalsEffect: { systolicBp: -6, diastolicBp: -4, hr: 6 },
    },
    {
      id: "request_surgical_review",
      category: "treat",
      label: "Refer to surgeons for a possible acute abdomen",
      timeCostMin: 10,
      moneyCost: 0,
      riskNote: "Diverts attention from the metabolic emergency.",
      result: {
        type: "text",
        content:
          "The surgical registrar examines him, finds a soft abdomen and asks whether anyone has checked a glucose. Ten minutes gone.",
      },
      clueTier: "none",
      supports: [],
      against: ["appendicitis"],
      triggersEvent: "",
      isUnnecessary: true,
    },
    {
      id: "discharge_gastroenteritis",
      category: "treat",
      label: "Discharge with antiemetics for gastroenteritis",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Catastrophic risk from untreated ketoacidosis.",
      result: {
        type: "text",
        content:
          "Jean-Paul is sent home with antiemetics. His roommate finds him unresponsive before dawn; untreated ketoacidosis has progressed to coma and cardiac arrest.",
      },
      clueTier: "none",
      supports: ["gastroenteritis"],
      against: [],
      triggersEvent: "patient_lost_after_discharge",
      harmful: true,
      immediateFailure: true,
    },
  ],
  differential: [
    {
      id: "diabetic_ketoacidosis",
      label: "Diabetic ketoacidosis (new type 1 diabetes)",
      isCorrect: true,
      isTempting: false,
    },
    {
      id: "gastroenteritis",
      label: "Acute gastroenteritis / food poisoning",
      isCorrect: false,
      isTempting: true,
    },
    { id: "appendicitis", label: "Acute appendicitis", isCorrect: false, isTempting: false },
    { id: "acute_pancreatitis", label: "Acute pancreatitis", isCorrect: false, isTempting: false },
    {
      id: "hyperosmolar_hyperglycaemic_state",
      label: "Hyperosmolar hyperglycaemic state",
      isCorrect: false,
      isTempting: false,
    },
  ],
  hints: [
    {
      tier: 1,
      cost: 0,
      text: "Vomiting and cramps are common; a drowsy young patient breathing like he has run a race is not. Treat the dehydration while you work out why.",
    },
    {
      tier: 2,
      cost: 5,
      text: "Ask what the last few weeks have been like — thirst, urine, weight. Then pick the cheapest, fastest bedside test in the department.",
    },
    {
      tier: 3,
      cost: 10,
      text: "This is a metabolic emergency: fluids first, know the potassium, then a fixed-rate insulin infusion. Bicarbonate is not your friend.",
    },
  ],
  solution: {
    diagnosis: "Diabetic ketoacidosis presenting as new type 1 diabetes",
    diagnosisId: "diabetic_ketoacidosis",
    keyTreatment: [
      "start_monitoring",
      "start_iv_fluids",
      "replace_potassium",
      "start_insulin_infusion",
    ],
    teachingPoints: [
      "Check a capillary glucose in every vomiting, drowsy or hyperventilating patient; DKA often presents as an 'acute abdomen' or 'gastroenteritis'.",
      "The treatment order matters: fluids first, measure potassium, then a fixed-rate insulin infusion with potassium replacement as the level falls.",
      "Kussmaul breathing, ketotic breath and a high anion gap acidosis separate DKA from the hyperosmolar state and from simple dehydration.",
    ],
    whyNotTempting:
      "Food poisoning explains a day of vomiting and cramps, but not two weeks of thirst and polyuria, weight loss, Kussmaul breathing, a glucose of 28 and a pH of 7.08. The 'gastroenteritis' was the ketoacidosis announcing itself.",
    harmfulActionDebrief: {
      give_bicarbonate:
        "Bicarbonate does not speed recovery from DKA and worsens hypokalaemia and cerebral oedema risk; it is reserved for life-threatening acidaemia under senior guidance.",
      give_oral_rehydration_only:
        "A shocked, vomiting patient cannot be rehydrated by mouth; relying on oral fluids delayed the IV resuscitation he needed immediately.",
      discharge_gastroenteritis:
        "Discharging a drowsy, tachycardic, hyperventilating patient as gastroenteritis left a fatal metabolic emergency untreated.",
    },
  },
  scoring: {
    base: 100,
    perMinutePenaltyAfter: 20,
    perMinutePenalty: -1,
    perUnnecessaryTest: -3,
    perHarmfulAction: -15,
    bonusKeyClueFoundEarly: 10,
    earlyClueCutoffMinute: 8,
    incorrectDiagnosisPenalty: -40,
    perMissedKeyTreatment: -5,
  },
  assets: [],
  mockComparisonPercent: 72,
};
