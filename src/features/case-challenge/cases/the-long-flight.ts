import { ecgAnnotation } from "../ecg.js";
import type { MedicalCase, ResultCondition } from "../schema.js";

/*
 * Patient states the responses track:
 * - HYPOXIC: SpO₂ under 88% (no oxygen by minute 8, or sedated).
 * - RV_STRAIN: the "no oxygen" deterioration fired; clot burden and hypoxia
 *   are now straining the right ventricle (ECG, CT, troponin, JVP all show it).
 * - ON_OXYGEN: supplemental oxygen has been started.
 */
const HYPOXIC: ResultCondition = { vitals: { spo2: { below: 88 } } };
const RV_STRAIN: ResultCondition = { afterDeterioration: ["pe_no_oxygen"] };
const ON_OXYGEN: ResultCondition = { afterActions: ["give_oxygen"] };

export const theLongFlight: MedicalCase = {
  id: "a1000000-0000-4000-8000-000000000001",
  slug: "case_001",
  title: "The Long Flight",
  difficulty: 2,
  specialty: ["Emergency", "Pulmonology"],
  setting: "ER, 2:47 AM",
  intro:
    "ER, 2:47 AM. A 34-year-old woman is wheeled in by her husband. She was fine at dinner. Now she can barely finish a sentence.",
  reviewStatus: "clinician_reviewed",
  patient: {
    name: "Amara",
    age: 34,
    sex: "Female",
    avatar: {
      skinTone: "deep_brown",
      hair: "dark_braided_bun",
      outfit: "teal_blouse",
      ageCues: "young_adult",
    },
    personality: "Usually composed; frightened now, speaking quickly in short, breathless phrases.",
    chiefComplaint: "Sudden breathlessness and pleuritic chest pain after a long-haul flight.",
    presentingTags: ["Short of breath", "Chest pain", "Recent travel"],
    initialExpression: "struggling_to_breathe",
  },
  vitalsTimeline: [
    { tMinute: 0, hr: 118, bp: "108/68", rr: 26, spo2: 91, temp: 37.1 },
    { tMinute: 8, hr: 130, bp: "102/64", rr: 30, spo2: 86, temp: 37.1 },
    { tMinute: 18, hr: 142, bp: "88/54", rr: 35, spo2: 80, temp: 37.0 },
  ],
  deteriorationRules: [
    {
      id: "pe_no_oxygen",
      ifNotDoneBy: 8,
      action: "give_oxygen",
      effect: { spo2: -5, hr: 12, rr: 4, systolicBp: -6, diastolicBp: -4 },
      alertLine: "Doctor, her saturation is falling — 86% and her heart rate is climbing.",
      source: "nurse",
      triggersEvent: "hypoxemia_worsens",
      lossAtMinute: 18,
    },
    {
      id: "pe_no_monitoring",
      ifNotDoneBy: 8,
      action: "start_monitoring",
      effect: { hr: 4 },
      alertLine: "Can someone please keep the monitor on? I feel worse when I sit up.",
      source: "patient",
      triggersEvent: "unmonitored_deterioration",
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
          "It hit me all at once after dinner. The pain is sharp, especially when I breathe in — I feel like I'm going to die.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: {
            content:
              "All at once… after dinner. Sharp… when I breathe in. I can't — get my breath.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["pulmonary_embolism", "panic_attack"],
      against: ["pneumonia"],
      triggersEvent: "",
    },
    {
      id: "ask_travel",
      category: "ask",
      label: "Ask about recent travel",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "I just got back from Nairobi on Saturday... I took the long flight, nine hours. That was three days ago.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: { content: "Nairobi… back Saturday. Nine-hour flight… three days ago." },
        },
      ],
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack"],
      triggersEvent: "travel_risk_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_medications",
      category: "ask",
      label: "Ask about medications",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content: "Only my combined contraceptive pill. I've taken it for about two years.",
      },
      variants: [
        { when: HYPOXIC, result: { content: "Just… the pill. The combined one. Two years." } },
      ],
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: [],
      triggersEvent: "hormone_risk_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_cough_fever",
      category: "ask",
      label: "Ask about cough and fever",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content: "A small dry cough today, but no fever and no phlegm.",
      },
      variants: [{ when: HYPOXIC, result: { content: "Bit of… dry cough. No fever. No phlegm." } }],
      clueTier: "obvious",
      supports: ["pulmonary_embolism"],
      against: ["pneumonia"],
      triggersEvent: "",
    },
    {
      id: "ask_leg_symptoms",
      category: "ask",
      label: "Ask about leg symptoms",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "My left calf has felt tight since the flight. I thought I'd pulled a muscle carrying my bag.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: { content: "Left calf… tight since the flight. Thought I'd… pulled it." },
        },
      ],
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack", "pneumonia"],
      triggersEvent: "calf_symptom_revealed",
      isKeyClue: true,
    },
    {
      id: "ask_anxiety_history",
      category: "ask",
      label: "Ask about anxiety or panic attacks",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "patient_reply",
        content:
          "Work has been stressful, but I've never had a panic attack or felt anything like this.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: { content: "Never… a panic attack. Never felt… anything like this." },
        },
      ],
      clueTier: "red_herring",
      supports: ["panic_attack"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "check_vitals",
      category: "examine",
      label: "Repeat vital signs",
      timeCostMin: 1,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. She is anxious and speaking in short phrases.",
      },
      variants: [
        {
          when: { ...ON_OXYGEN, vitals: { spo2: { below: 92 } } },
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on high-flow oxygen, temperature {temp}°C. Even on oxygen she is struggling and speaks only in short phrases.",
          },
        },
        {
          when: ON_OXYGEN,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on supplemental oxygen, temperature {temp}°C. Still tachycardic, but more settled and managing fuller sentences.",
          },
        },
        {
          when: { afterActions: ["give_anxiolytic"] },
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. Since the sedative she is drowsy, and her breathing is shallower but no less laboured.",
          },
        },
        {
          when: HYPOXIC,
          result: {
            content:
              "HR {hr}, BP {bp}, RR {rr}, SpO₂ {spo2}% on room air, temperature {temp}°C. She is tiring: bolt upright, using her accessory muscles, managing only single words.",
          },
        },
      ],
      clueTier: "obvious",
      supports: ["pulmonary_embolism", "panic_attack"],
      against: ["pneumonia"],
      triggersEvent: "",
      isCritical: true,
    },
    {
      id: "examine_lungs",
      category: "examine",
      label: "Examine the chest",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Air entry is equal. The lungs are clear without focal crackles or wheeze. Deep inspiration reproduces the pain.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: {
            content:
              "Air entry is equal and the lungs are still clear — no crackles or wheeze — despite her worsening hypoxaemia. She is using accessory muscles at {rr} breaths/min, and deep inspiration reproduces the pain.",
          },
        },
      ],
      clueTier: "contradicting",
      supports: ["pulmonary_embolism"],
      against: ["pneumonia"],
      triggersEvent: "",
    },
    {
      id: "examine_legs",
      category: "examine",
      label: "Examine both legs",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Do not vigorously massage a limb when DVT is suspected.",
      result: {
        type: "text",
        content:
          "The left calf is subtly fuller than the right and tender along the deep venous system. No cellulitis or injury is visible.",
      },
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack", "pneumonia"],
      triggersEvent: "dvt_signs_found",
      isKeyClue: true,
    },
    {
      id: "examine_heart",
      category: "examine",
      label: "Examine the cardiovascular system",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "",
      result: {
        type: "text",
        content:
          "Regular tachycardia at {hr} bpm. Heart sounds are normal, JVP is not elevated, and the peripheries are warm.",
      },
      variants: [
        {
          when: RV_STRAIN,
          result: {
            content:
              "Regular tachycardia at {hr} bpm with a loud P2. The JVP is now raised and her hands are cool — her right ventricle is struggling.",
          },
        },
      ],
      clueTier: "none",
      supports: ["pulmonary_embolism"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "order_cxr",
      category: "test",
      label: "Chest X-ray",
      timeCostMin: 4,
      moneyCost: 85,
      riskNote: "Low-dose ionising radiation.",
      result: {
        type: "image",
        content:
          "The frontal chest radiograph is essentially normal: no focal consolidation, effusion, or pneumothorax. The lungs look far better than her oxygen saturation would suggest.",
        assetId: "pe_cxr_normal",
        annotation: {
          xPercent: 50,
          yPercent: 48,
          radiusPercent: 42,
          label: "No focal air-space opacity",
        },
      },
      clueTier: "contradicting",
      supports: ["pulmonary_embolism", "panic_attack"],
      against: ["pneumonia"],
      triggersEvent: "normal_cxr_found",
      isKeyClue: true,
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
          "{rhythm} at {hr} bpm. Subtle T-wave inversion in V1 only; no ST elevation. The tracing is otherwise non-specific.",
        ecg: { preset: "pe_early" },
        annotation: ecgAnnotation(
          ["rhythm"],
          14,
          "Regular narrow-complex tachycardia; no ST elevation",
        ),
      },
      variants: [
        {
          when: RV_STRAIN,
          result: {
            content:
              "{rhythm} at {hr} bpm with a new S1Q3T3 pattern, incomplete right bundle branch block and T-wave inversion in V1–V4: acute right ventricular strain. No ST elevation.",
            ecg: { preset: "pe_rv_strain" },
            annotation: ecgAnnotation(
              ["V1", "V2", "V3"],
              19,
              "T-wave inversion V1–V3 (right ventricular strain)",
            ),
          },
        },
      ],
      clueTier: "obvious",
      supports: ["pulmonary_embolism", "panic_attack"],
      against: [],
      triggersEvent: "",
    },
    {
      id: "order_bloods",
      category: "test",
      label: "D-dimer, troponin, FBC and CRP",
      timeCostMin: 6,
      moneyCost: 110,
      riskNote: "Venepuncture.",
      result: {
        type: "lab_table",
        content:
          "The D-dimer is markedly elevated. Troponin is mildly raised, while inflammatory markers are normal.",
        labs: [
          { test: "D-dimer", result: "3,480 ng/mL FEU", reference: "<500", flag: "high" },
          { test: "High-sensitivity troponin", result: "28 ng/L", reference: "<14", flag: "high" },
          { test: "WBC", result: "8.2 ×10⁹/L", reference: "4.0–11.0", flag: "normal" },
          { test: "CRP", result: "3 mg/L", reference: "<5", flag: "normal" },
        ],
      },
      variants: [
        {
          when: RV_STRAIN,
          result: {
            content:
              "The D-dimer is markedly elevated. Troponin has risen further, in keeping with right ventricular strain; inflammatory markers are normal.",
            labs: [
              { test: "D-dimer", result: "3,620 ng/mL FEU", reference: "<500", flag: "high" },
              {
                test: "High-sensitivity troponin",
                result: "64 ng/L",
                reference: "<14",
                flag: "high",
              },
              { test: "WBC", result: "8.6 ×10⁹/L", reference: "4.0–11.0", flag: "normal" },
              { test: "CRP", result: "3 mg/L", reference: "<5", flag: "normal" },
            ],
          },
        },
      ],
      clueTier: "contradicting",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack", "pneumonia"],
      triggersEvent: "d_dimer_positive",
      isKeyClue: true,
    },
    {
      id: "order_abg",
      category: "test",
      label: "Arterial blood gas",
      timeCostMin: 4,
      moneyCost: 70,
      riskNote: "Painful arterial puncture.",
      result: {
        type: "lab_table",
        content: "On room air: hypoxaemia with respiratory alkalosis.",
        labs: [
          { test: "pH", result: "7.48", reference: "7.35–7.45", flag: "high" },
          { test: "PaO₂", result: "7.4 kPa", reference: "10.7–13.3", flag: "low" },
          { test: "PaCO₂", result: "3.7 kPa", reference: "4.7–6.0", flag: "low" },
          { test: "Lactate", result: "1.6 mmol/L", reference: "0.5–2.2", flag: "normal" },
        ],
      },
      variants: [
        {
          when: { afterActions: ["give_anxiolytic"], notAfterActions: ["give_oxygen"] },
          result: {
            content:
              "On room air after sedation: worse hypoxaemia, and the PaCO₂ has crept back to normal as she tires — falsely reassuring evidence of hypoventilation.",
            labs: [
              { test: "pH", result: "7.40", reference: "7.35–7.45", flag: "normal" },
              { test: "PaO₂", result: "6.6 kPa", reference: "10.7–13.3", flag: "low" },
              { test: "PaCO₂", result: "5.0 kPa", reference: "4.7–6.0", flag: "normal" },
              { test: "Lactate", result: "2.1 mmol/L", reference: "0.5–2.2", flag: "normal" },
            ],
          },
        },
        {
          when: { ...ON_OXYGEN, vitals: { spo2: { below: 92 } } },
          result: {
            content:
              "On supplemental oxygen: still hypoxaemic, with respiratory alkalosis and a rising lactate.",
            labs: [
              { test: "pH", result: "7.48", reference: "7.35–7.45", flag: "high" },
              { test: "PaO₂", result: "8.4 kPa", reference: "10.7–13.3", flag: "low" },
              { test: "PaCO₂", result: "3.5 kPa", reference: "4.7–6.0", flag: "low" },
              { test: "Lactate", result: "2.6 mmol/L", reference: "0.5–2.2", flag: "high" },
            ],
          },
        },
        {
          when: ON_OXYGEN,
          result: {
            content:
              "On supplemental oxygen: oxygenation has improved, but the PaO₂ is far lower than the inspired oxygen should achieve (wide A–a gradient). Respiratory alkalosis persists.",
            labs: [
              { test: "pH", result: "7.47", reference: "7.35–7.45", flag: "high" },
              { test: "PaO₂", result: "11.2 kPa", reference: "10.7–13.3", flag: "normal" },
              { test: "PaCO₂", result: "3.8 kPa", reference: "4.7–6.0", flag: "low" },
              { test: "Lactate", result: "1.4 mmol/L", reference: "0.5–2.2", flag: "normal" },
            ],
          },
        },
        {
          when: HYPOXIC,
          result: {
            content:
              "On room air: severe hypoxaemia with respiratory alkalosis; lactate is rising.",
            labs: [
              { test: "pH", result: "7.50", reference: "7.35–7.45", flag: "high" },
              { test: "PaO₂", result: "6.3 kPa", reference: "10.7–13.3", flag: "critical" },
              { test: "PaCO₂", result: "3.3 kPa", reference: "4.7–6.0", flag: "low" },
              { test: "Lactate", result: "2.8 mmol/L", reference: "0.5–2.2", flag: "high" },
            ],
          },
        },
      ],
      clueTier: "obvious",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack"],
      triggersEvent: "hypoxemia_confirmed",
    },
    {
      id: "order_doppler",
      category: "test",
      label: "Left leg Doppler ultrasound",
      timeCostMin: 12,
      moneyCost: 180,
      riskNote: "No ionising radiation.",
      result: {
        type: "text",
        content:
          "The left popliteal vein is non-compressible with visible thrombus, confirming a proximal DVT.",
      },
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack", "pneumonia"],
      triggersEvent: "dvt_confirmed",
      isKeyClue: true,
    },
    {
      id: "order_ctpa",
      category: "test",
      label: "CT pulmonary angiogram",
      timeCostMin: 18,
      moneyCost: 420,
      riskNote: "Ionising radiation and iodinated contrast exposure.",
      result: {
        type: "image",
        content:
          "A central filling defect straddles the main pulmonary artery bifurcation, with emboli extending into both pulmonary arteries. The right ventricle is at the upper limit of normal size (RV:LV ratio 1.0).",
        assetId: "pe_ctpa_filling_defect",
        annotation: {
          xPercent: 51,
          yPercent: 48,
          radiusPercent: 12,
          label: "Pulmonary arterial filling defect",
        },
      },
      variants: [
        {
          when: RV_STRAIN,
          result: {
            content:
              "A central filling defect straddles the main pulmonary artery bifurcation, with emboli extending into both pulmonary arteries. The right ventricle is dilated (RV:LV ratio 1.4) with the septum bowing toward the left ventricle — CT signs of right heart strain.",
          },
        },
      ],
      clueTier: "buried",
      supports: ["pulmonary_embolism"],
      against: ["panic_attack", "pneumonia"],
      triggersEvent: "pe_confirmed",
      isKeyClue: true,
    },
    {
      id: "order_abdominal_ultrasound",
      category: "test",
      label: "Abdominal ultrasound",
      timeCostMin: 15,
      moneyCost: 160,
      riskNote: "No direct harm, but delays definitive imaging.",
      result: {
        type: "text",
        content: "Normal liver, gallbladder, kidneys, and visualised abdominal aorta.",
      },
      clueTier: "red_herring",
      supports: [],
      against: [],
      triggersEvent: "",
      isUnnecessary: true,
    },
    {
      id: "give_oxygen",
      category: "treat",
      label: "Give supplemental oxygen",
      timeCostMin: 1,
      moneyCost: 15,
      riskNote: "Titrate to the patient's oxygen target.",
      result: {
        type: "text",
        content:
          "Oxygen is applied via a non-rebreather mask. Her saturation rises to {spo2}% and she can speak more comfortably.",
      },
      variants: [
        {
          when: HYPOXIC,
          result: {
            content:
              "Oxygen is applied via a non-rebreather mask. Her saturation climbs only to {spo2}%: better, but she is still hypoxaemic until the cause is treated.",
          },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "oxygen_started",
      isCritical: true,
      vitalsEffect: { spo2: 4, rr: -2 },
    },
    {
      id: "gain_iv_access",
      category: "treat",
      label: "Gain IV access",
      timeCostMin: 2,
      moneyCost: 20,
      riskNote: "Minor cannulation risks.",
      result: {
        type: "text",
        content: "Two peripheral IV cannulas are placed and baseline blood samples are drawn.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "iv_access_ready",
      isCritical: true,
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
          "Continuous ECG, blood pressure and pulse oximetry are started. The monitor shows {rhythm} at {hr} bpm, BP {bp}, SpO₂ {spo2}%.",
      },
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "monitoring_started",
      isCritical: true,
    },
    {
      id: "start_anticoagulation",
      category: "treat",
      label: "Start therapeutic anticoagulation",
      timeCostMin: 2,
      moneyCost: 95,
      riskNote: "Bleeding risk; check contraindications and diagnostic probability.",
      result: {
        type: "text",
        content:
          "Therapeutic anticoagulation is started after bleeding contraindications are checked.",
      },
      clueTier: "none",
      supports: ["pulmonary_embolism"],
      against: [],
      triggersEvent: "anticoagulation_started",
      vitalsEffect: { hr: -4 },
      penalizeWhenUnsafe: true,
      safeWhen: {
        anyActionIds: ["order_ctpa", "order_doppler"],
        supportingActionThreshold: {
          actionIds: ["ask_travel", "ask_medications", "ask_leg_symptoms", "examine_legs"],
          minimumCompleted: 3,
        },
        explanation:
          "Anticoagulation is appropriate after confirmation or when clinical probability is high and bleeding risk is acceptable.",
      },
    },
    {
      id: "give_thrombolysis",
      category: "treat",
      label: "Give systemic thrombolysis",
      timeCostMin: 3,
      moneyCost: 680,
      riskNote:
        "Major and intracranial bleeding risk; reserved for haemodynamic instability in PE.",
      result: {
        type: "text",
        content:
          "Thrombolysis is given although her blood pressure is holding at {bp}. Without shock, it exposes Amara to major and intracranial bleeding risk for no survival benefit.",
      },
      variants: [
        {
          when: { afterActions: ["start_anticoagulation"] },
          result: {
            content:
              "Thrombolysis is given on top of therapeutic anticoagulation, although her blood pressure is holding at {bp}. Without shock, the combination adds major and intracranial bleeding risk for no survival benefit.",
          },
        },
      ],
      clueTier: "none",
      supports: [],
      against: [],
      triggersEvent: "unnecessary_thrombolysis",
      harmful: true,
    },
    {
      id: "give_antibiotics",
      category: "treat",
      label: "Start broad-spectrum antibiotics",
      timeCostMin: 2,
      moneyCost: 75,
      riskNote: "Adverse drug effects and delay of correct treatment.",
      result: {
        type: "text",
        content:
          "Antibiotics are given, but they do not address her worsening hypoxaemia or thromboembolic disease.",
      },
      clueTier: "none",
      supports: ["pneumonia"],
      against: [],
      triggersEvent: "wrong_treatment_antibiotics",
      harmful: true,
    },
    {
      id: "give_anxiolytic",
      category: "treat",
      label: "Reassure and give an anxiolytic",
      timeCostMin: 2,
      moneyCost: 25,
      riskNote: "Sedation can mask deterioration and depress respiration.",
      result: {
        type: "text",
        content:
          "She becomes drowsier while remaining hypoxaemic. The monitor flashes red as her saturation falls to {spo2}%.",
      },
      variants: [
        {
          when: ON_OXYGEN,
          result: {
            content:
              "She becomes drowsy and her breathing turns shallow. Even on oxygen, her saturation drifts down to {spo2}%.",
          },
        },
      ],
      clueTier: "none",
      supports: ["panic_attack"],
      against: [],
      triggersEvent: "sedation_worsens_hypoxemia",
      harmful: true,
      vitalsEffect: { spo2: -3, rr: -3 },
    },
    {
      id: "discharge_anxiety",
      category: "treat",
      label: "Discharge with presumed anxiety",
      timeCostMin: 2,
      moneyCost: 0,
      riskNote: "Catastrophic risk from untreated pulmonary embolism.",
      result: {
        type: "text",
        content: "Shortly after leaving, Amara collapses from untreated pulmonary embolism.",
      },
      clueTier: "none",
      supports: ["panic_attack"],
      against: [],
      triggersEvent: "patient_lost_after_discharge",
      harmful: true,
      immediateFailure: true,
    },
  ],
  differential: [
    { id: "pulmonary_embolism", label: "Pulmonary embolism", isCorrect: true, isTempting: false },
    { id: "panic_attack", label: "Anxiety / panic attack", isCorrect: false, isTempting: true },
    { id: "pneumonia", label: "Community-acquired pneumonia", isCorrect: false, isTempting: false },
    { id: "pneumothorax", label: "Spontaneous pneumothorax", isCorrect: false, isTempting: false },
    {
      id: "acute_coronary_syndrome",
      label: "Acute coronary syndrome",
      isCorrect: false,
      isTempting: false,
    },
  ],
  hints: [
    {
      tier: 1,
      cost: 0,
      text: "Her fear is real, but it may be a response to physiology. Start with immediate threats and her recent days.",
    },
    {
      tier: 2,
      cost: 5,
      text: "What would you want to know about travel, immobility, hormones, and one-sided leg symptoms?",
    },
    {
      tier: 3,
      cost: 10,
      text: "Prioritise a venous thromboembolic cause over infection or primary anxiety, then confirm it safely.",
    },
  ],
  solution: {
    diagnosis: "Acute pulmonary embolism with a left lower-limb DVT",
    diagnosisId: "pulmonary_embolism",
    keyTreatment: ["give_oxygen", "start_monitoring", "gain_iv_access", "start_anticoagulation"],
    teachingPoints: [
      "Use clinical probability tools such as the Wells score to decide when D-dimer or definitive imaging is appropriate.",
      "A normal chest X-ray does not rule out pulmonary embolism; it can make pneumonia and pneumothorax less likely.",
      "In unexplained dyspnoea, ask about travel, immobility, hormones, and calf symptoms; anxiety is a diagnosis of exclusion.",
    ],
    whyNotTempting:
      "Panic can explain fear, tachycardia, and rapid breathing, but not objective hypoxaemia, unilateral calf findings, thrombotic risk factors, or a markedly elevated D-dimer. Anxiety here is a consequence, not the cause.",
    harmfulActionDebrief: {
      give_thrombolysis:
        "She was not haemodynamically unstable, so systemic thrombolysis added serious bleeding risk without a clear indication.",
      give_antibiotics:
        "No fever, normal inflammatory markers, clear lungs, and a normal radiograph made pneumonia unlikely.",
      give_anxiolytic:
        "Sedation masked respiratory deterioration and risked worsening hypoventilation in an already hypoxaemic patient.",
      discharge_anxiety:
        "Discharging persistent hypoxaemia and tachycardia as anxiety left a life-threatening PE untreated.",
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
  assets: [
    {
      id: "pe_cxr_normal",
      filename: "normal-pa-chest-radiograph.jpg",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Normal_posteroanterior_(PA)_chest_radiograph_(X-ray).jpg",
      author: "Mikael Häggström",
      license: "CC0 1.0 Universal",
      requiredAttributionText:
        "Normal posteroanterior chest radiograph by Mikael Häggström, via Wikimedia Commons (CC0 1.0).",
      altText:
        "Normal posteroanterior chest radiograph showing clear lungs without focal air-space opacity.",
      isPlaceholder: false,
    },
    {
      id: "pe_ctpa_filling_defect",
      filename: "saddle-pe-ctpa.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:SADDLE_PE.JPG",
      author: "Glitzy queen00",
      license: "Public domain",
      requiredAttributionText:
        "Saddle pulmonary embolus CTPA by Glitzy queen00, via Wikimedia Commons (public domain).",
      altText:
        "Axial CT pulmonary angiogram showing a saddle embolus across the main pulmonary artery bifurcation.",
      isPlaceholder: false,
    },
  ],
  mockComparisonPercent: 68,
};
