import type {
  MedicalCase,
  PatientExpression,
  VitalsSnapshot,
} from "@/features/case-challenge/schema";
import { initialVitals } from "../../case-analysis";
import { BUILD_STEP_META, EXPRESSION_META } from "../../vocabulary";
import {
  Disclosure,
  Field,
  NumberInput,
  Panel,
  PanelHeading,
  SelectInput,
  TagInput,
  TextArea,
  TextInput,
  VisibilityTag,
} from "../studio-ui";

function omitKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export function VitalsSnapshotFields({
  snapshot,
  onChange,
}: {
  snapshot: VitalsSnapshot;
  onChange: (next: VitalsSnapshot) => void;
}) {
  const set = (partial: Partial<VitalsSnapshot>) => onChange({ ...snapshot, ...partial });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Field label="Heart rate" required>
        <NumberInput value={snapshot.hr} suffix="bpm" onChange={(hr) => set({ hr: hr ?? 0 })} />
      </Field>
      <Field label="Blood pressure" required help="e.g. 118/76">
        <TextInput value={snapshot.bp} onChange={(bp) => set({ bp })} inputMode="numeric" />
      </Field>
      <Field label="Respiratory rate" required>
        <NumberInput value={snapshot.rr} suffix="/min" onChange={(rr) => set({ rr: rr ?? 0 })} />
      </Field>
      <Field label="SpO₂" required>
        <NumberInput
          value={snapshot.spo2}
          suffix="%"
          min={0}
          max={100}
          onChange={(spo2) => set({ spo2: spo2 ?? 0 })}
        />
      </Field>
      <Field label="Temperature" required>
        <NumberInput
          value={snapshot.temp}
          step={0.1}
          suffix="°C"
          onChange={(temp) => set({ temp: temp ?? 0 })}
        />
      </Field>
    </div>
  );
}

export function BuilderPatientStep({
  definition,
  onChange,
}: {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const patient = definition.patient;
  const patch = (partial: Partial<MedicalCase>) => onChange({ ...definition, ...partial });
  const setPatient = (partial: Partial<MedicalCase["patient"]>) =>
    patch({ patient: { ...patient, ...partial } });
  const setAvatar = (partial: Partial<MedicalCase["patient"]["avatar"]>) =>
    setPatient({ avatar: { ...patient.avatar, ...partial } });
  const words = definition.intro.trim() ? definition.intro.trim().split(/\s+/).length : 0;
  const arrival = definition.vitalsTimeline[0] ?? {
    tMinute: 0,
    hr: 90,
    bp: "120/78",
    rr: 18,
    spo2: 97,
    temp: 37,
  };
  const readable = initialVitals(definition);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META.patient.title}
          description={BUILD_STEP_META.patient.blurb}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Patient's first name"
            required
            anchor="studio-patient-name"
            className="lg:col-span-2"
          >
            <TextInput
              value={patient.name}
              onChange={(name) => setPatient({ name })}
              placeholder="e.g. Amara"
            />
          </Field>
          <Field label="Age" required>
            <NumberInput
              value={patient.age}
              min={0}
              max={120}
              suffix="years"
              onChange={(age) => setPatient({ age: age ?? 0 })}
            />
          </Field>
          <Field label="Sex" required help="Also picks the ward image.">
            <SelectInput
              value={patient.sex}
              onChange={(sex) => setPatient({ sex })}
              options={[...new Set(["Female", "Male", patient.sex].filter(Boolean))].map(
                (value) => ({
                  value,
                  label: value,
                }),
              )}
            />
          </Field>
          <Field
            label="Where and when"
            required
            help="Shown on the patient card and as the scene heading."
            example="ER, 2:47 AM"
            anchor="studio-setting"
            className="sm:col-span-2"
          >
            <TextInput value={definition.setting} onChange={(setting) => patch({ setting })} />
          </Field>
          <Field
            label="How they look on arrival"
            help="Changes on its own as the observations worsen."
            className="sm:col-span-2"
          >
            <SelectInput
              value={patient.initialExpression}
              onChange={(initialExpression: PatientExpression) => setPatient({ initialExpression })}
              options={(Object.keys(EXPRESSION_META) as PatientExpression[]).map((value) => ({
                value,
                label: EXPRESSION_META[value],
              }))}
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeading
          level={3}
          title="The opening"
          aside={<VisibilityTag visibility="students" />}
        />
        <div className="space-y-5">
          <Field
            label="Opening scene"
            required
            help={`What the student hears as the case begins. Present tense, mid-scene, at most 40 words (${words}/40).`}
            example="ER, 2:47 AM. A 34-year-old woman is wheeled in by her husband. She was fine at dinner."
            anchor="studio-intro"
          >
            <TextArea value={definition.intro} onChange={(intro) => patch({ intro })} rows={3} />
            {words > 40 && (
              <p className="mt-1 text-[13px] font-bold text-[#8f2424]">
                {words - 40} words over the limit.
              </p>
            )}
          </Field>
          <Field
            label="Presenting complaint"
            help="One sentence, as it would appear on the triage note."
            example="Sudden breathlessness and pleuritic chest pain after a long-haul flight."
            anchor="studio-patient-chiefComplaint"
          >
            <TextInput
              value={patient.chiefComplaint}
              onChange={(chiefComplaint) => setPatient({ chiefComplaint })}
            />
          </Field>
          <Field
            label="Key features on the patient card"
            help="Two to four short chips. Type and press Enter."
            example="Short of breath"
            anchor="studio-patient-presentingTags"
          >
            <TagInput
              value={patient.presentingTags ?? []}
              onChange={(presentingTags) => setPatient({ presentingTags })}
              placeholder="e.g. Chest pain"
            />
          </Field>
          <Field
            label="How the patient speaks"
            help="Reviewers check every reply against this. Not shown to students."
            example="Usually composed; frightened now, speaking in short, breathless phrases."
            anchor="studio-patient-personality"
          >
            <TextArea
              value={patient.personality}
              onChange={(personality) => setPatient({ personality })}
              rows={2}
            />
          </Field>
        </div>
      </Panel>

      <Panel id="studio-vitals">
        <PanelHeading
          level={3}
          title="Observations on arrival"
          description="The patient's vital signs when the case starts. The Progression step decides how they change."
          aside={<VisibilityTag visibility="students" />}
        />
        <VitalsSnapshotFields
          snapshot={arrival}
          onChange={(next) =>
            patch({
              vitalsTimeline: [{ ...next, tMinute: 0 }, ...definition.vitalsTimeline.slice(1)],
            })
          }
        />
        {!readable && (
          <p className="mt-2 text-[13px] font-bold text-[#8f2424]">
            Write blood pressure as two numbers, e.g. 118/76.
          </p>
        )}
      </Panel>

      <Disclosure
        title="Appearance details (advanced)"
        summary="Ward image and the illustrated portrait used on the home screen"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Ward image" help="Which pre-rendered ward the student sees.">
            <SelectInput
              value={patient.model ?? "auto"}
              onChange={(value) =>
                patch({
                  patient:
                    value === "auto"
                      ? omitKey(patient, "model")
                      : { ...patient, model: value as "female" | "male" },
                })
              }
              options={[
                { value: "auto", label: "Match the patient's sex" },
                { value: "female", label: "Female ward" },
                { value: "male", label: "Male ward" },
              ]}
            />
          </Field>
          <Field label="Age appearance">
            <SelectInput
              value={patient.avatar.ageCues ?? "young_adult"}
              onChange={(ageCues) => setAvatar({ ageCues })}
              options={[
                { value: "young_adult", label: "Young adult" },
                { value: "middle_aged", label: "Middle aged" },
                { value: "older_adult", label: "Older adult" },
              ]}
            />
          </Field>
          <Field label="Skin tone" help="Portrait style key, e.g. medium_brown.">
            <TextInput
              value={patient.avatar.skinTone}
              onChange={(skinTone) => setAvatar({ skinTone })}
            />
          </Field>
          <Field label="Hair" help="e.g. short_black">
            <TextInput value={patient.avatar.hair} onChange={(hair) => setAvatar({ hair })} />
          </Field>
          <Field label="Clothing" help="e.g. plain_shirt">
            <TextInput value={patient.avatar.outfit} onChange={(outfit) => setAvatar({ outfit })} />
          </Field>
        </div>
      </Disclosure>
    </div>
  );
}
