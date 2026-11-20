import { Trash2 } from "lucide-react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import {
  addDiagnosis,
  removeDiagnosis,
  setCorrectDiagnosis,
  setTemptingDiagnosis,
  updateDiagnosisLabel,
} from "../../case-edits";
import { BUILD_STEP_META, DIFFICULTY_META, SPECIALTY_SUGGESTIONS } from "../../vocabulary";
import {
  ChoiceCards,
  Field,
  IconButton,
  Panel,
  PanelHeading,
  TagInput,
  TextArea,
  TextInput,
  VisibilityTag,
  useConfirm,
} from "../studio-ui";
import { AddRow } from "./small-editors";

export function BuilderBasicsStep({
  definition,
  onChange,
}: {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const confirm = useConfirm();
  const patch = (partial: Partial<MedicalCase>) => onChange({ ...definition, ...partial });
  const solution = definition.solution;
  const setSolution = (partial: Partial<MedicalCase["solution"]>) =>
    patch({ solution: { ...solution, ...partial } });

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeading
          title={BUILD_STEP_META.basics.title}
          description={BUILD_STEP_META.basics.blurb}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Case title"
            required
            help="Shown in the case library. Intriguing, without naming the diagnosis."
            example="The Long Flight"
            anchor="studio-title"
          >
            <TextInput value={definition.title} onChange={(title) => patch({ title })} />
          </Field>
          <Field
            label="Specialties"
            required
            help="Type and press Enter. Pick from the suggestions where you can."
            anchor="studio-specialty"
          >
            <TagInput
              value={definition.specialty}
              onChange={(specialty) => patch({ specialty })}
              placeholder="e.g. Emergency"
              suggestions={SPECIALTY_SUGGESTIONS}
            />
          </Field>
          <Field
            label="Difficulty"
            required
            group
            className="lg:col-span-2"
            anchor="studio-difficulty"
          >
            <ChoiceCards
              value={String(definition.difficulty) as "1" | "2" | "3"}
              onChange={(value) => patch({ difficulty: Number(value) as 1 | 2 | 3 })}
              columns={3}
              options={([1, 2, 3] as const).map((level) => ({
                value: String(level) as "1" | "2" | "3",
                label: `Level ${level} · ${DIFFICULTY_META[level].label}`,
                description: DIFFICULTY_META[level].description,
              }))}
            />
          </Field>
        </div>
      </Panel>

      <Panel id="studio-differential">
        <PanelHeading
          level={3}
          title="The diagnosis"
          description="Students commit to one diagnosis from the list below. Set it now so the evidence you write later can point to it."
          aside={<VisibilityTag visibility="reviewers" />}
        />
        <div className="space-y-5">
          <Field
            label="Final diagnosis, in full"
            required
            help="Revealed in the debrief."
            example="Acute pulmonary embolism with a left lower-limb DVT"
          >
            <TextInput
              value={solution.diagnosis}
              onChange={(diagnosis) => setSolution({ diagnosis })}
            />
          </Field>

          <Field
            label="Diagnoses students can choose from"
            required
            group
            help="Include the correct answer, one tempting wrong answer (the trap the case is built around) and two to four other reasonable options."
          >
            <div className="space-y-2">
              {definition.differential.map((item, index) => {
                const used = definition.actions.filter(
                  (action) => action.supports.includes(item.id) || action.against.includes(item.id),
                ).length;
                return (
                  <div
                    key={index}
                    className={cn(
                      "grid gap-2 rounded-2xl p-3 ring-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center",
                      item.isCorrect
                        ? "bg-mint-soft/70 ring-[#a9dcc6]"
                        : item.isTempting
                          ? "bg-yellow-soft/70 ring-[#ead79a]"
                          : "bg-card ring-border",
                    )}
                  >
                    <TextInput
                      value={item.label}
                      ariaLabel={`Diagnosis ${index + 1}`}
                      placeholder="e.g. Community-acquired pneumonia"
                      onChange={(label) =>
                        onChange(updateDiagnosisLabel(definition, item.id, label))
                      }
                    />
                    <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[13px] font-extrabold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7c63e0]">
                      <input
                        type="radio"
                        name="studio-correct"
                        checked={item.isCorrect}
                        onChange={() => onChange(setCorrectDiagnosis(definition, item.id))}
                        className="size-4 accent-[#0b5f5c]"
                      />
                      Correct answer
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[13px] font-extrabold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7c63e0]">
                      <input
                        type="radio"
                        name="studio-tempting"
                        checked={item.isTempting}
                        onChange={() => onChange(setTemptingDiagnosis(definition, item.id))}
                        className="size-4 accent-[#8a5a00]"
                      />
                      Tempting wrong answer
                    </label>
                    <IconButton
                      label={`Remove ${item.label || "this diagnosis"}`}
                      onClick={async () => {
                        if (
                          used &&
                          !(await confirm({
                            title: `Remove “${item.label}”?`,
                            confirmLabel: "Remove diagnosis",
                            description: `${used} finding${used === 1 ? " is" : "s are"} linked to it; those links will be removed.`,
                          }))
                        ) {
                          return;
                        }
                        onChange(removeDiagnosis(definition, item.id));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                );
              })}
              <AddRow onClick={() => onChange(addDiagnosis(definition))}>Add a diagnosis</AddRow>
            </div>
          </Field>

          <Field
            label="Why the tempting diagnosis is wrong"
            help="Shown in the debrief. Explain what it can and cannot account for."
            example="Panic can explain fear and tachycardia, but not objective hypoxaemia or unilateral calf findings."
          >
            <TextArea
              value={solution.whyNotTempting}
              rows={3}
              onChange={(whyNotTempting) => setSolution({ whyNotTempting })}
            />
          </Field>
        </div>
      </Panel>

      <Panel id="studio-teaching">
        <PanelHeading
          level={3}
          title="Learning goals"
          description="Exactly three teaching points. Students read them in the debrief; reviewers use them to judge whether the case teaches what it should."
          aside={<VisibilityTag visibility="debrief" />}
        />
        <div className="space-y-3">
          {solution.teachingPoints.map((point, index) => (
            <Field key={index} label={`Teaching point ${index + 1}`} required>
              <TextArea
                value={point}
                rows={2}
                onChange={(text) =>
                  setSolution({
                    teachingPoints: solution.teachingPoints.map((item, i) =>
                      i === index ? text : item,
                    ) as MedicalCase["solution"]["teachingPoints"],
                  })
                }
                placeholder={
                  index === 0
                    ? "e.g. A normal chest X-ray does not rule out pulmonary embolism."
                    : undefined
                }
              />
            </Field>
          ))}
        </div>
      </Panel>
    </div>
  );
}
