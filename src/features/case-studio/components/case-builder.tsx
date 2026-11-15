import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FileJson,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  ACTION_CATEGORIES,
  CLUE_TIERS,
  ECG_PRESETS,
  RESULT_TYPES,
  type ActionCategory,
  type ActionSafetyGate,
  type CaseAction,
  type CaseActionResult,
  type CaseAsset,
  type DeteriorationRule,
  type DifferentialDiagnosis,
  type LabRow,
  type MedicalCase,
  type PatientExpression,
  type ResultVariant,
  type VitalsDelta,
  type VitalsSnapshot,
} from "@/features/case-challenge/schema";
import {
  blankAction,
  copyToClipboard,
  downloadTextFile,
  exportFileName,
  inspectCase,
  newCaseId,
  parseCaseJson,
  toAssetManifest,
  toTypeScriptModule,
  type StudioIssue,
} from "../drafts";
import { ActionFlags } from "./case-inspector";
import {
  AddButton,
  Badge,
  Checkbox,
  ChipSelect,
  Field,
  IssueList,
  NumberInput,
  RemoveButton,
  SectionCard,
  SelectInput,
  TagInput,
  TextArea,
  TextInput,
  ToolButton,
  Toolbar,
} from "./studio-ui";

/*
 * The draft editor. Every field writes straight into the `MedicalCase` object
 * (the same shape the engine runs), so the live validation on the right is
 * exactly what CI will say about the exported module.
 */

const SPECIALTY_SUGGESTIONS = [
  "Emergency",
  "Cardiology",
  "Pulmonology",
  "Endocrinology",
  "Internal Medicine",
  "Obstetrics & Gynaecology",
  "General Surgery",
  "Paediatrics",
  "Neurology",
  "Infectious Diseases",
  "Nephrology",
  "Gastroenterology",
  "Psychiatry",
  "Toxicology",
];

const EXPRESSIONS: readonly { value: PatientExpression; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "in_pain", label: "In pain" },
  { value: "anxious", label: "Anxious" },
  { value: "struggling_to_breathe", label: "Struggling to breathe" },
  { value: "drowsy", label: "Drowsy" },
  { value: "relieved", label: "Relieved" },
];

const VITAL_KEYS: readonly { key: keyof VitalsDelta; label: string }[] = [
  { key: "hr", label: "HR" },
  { key: "systolicBp", label: "Systolic" },
  { key: "diastolicBp", label: "Diastolic" },
  { key: "rr", label: "RR" },
  { key: "spo2", label: "SpO₂" },
  { key: "temp", label: "Temp" },
];

type Tab = "form" | "json";

/** Drop an optional key entirely (the schema uses absence, not `undefined`). */
function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const next = { ...value };
  delete next[key];
  return next;
}

export function CaseBuilder({
  draft,
  updatedAt,
  takenSlugs,
  onChange,
  onDelete,
  onPlaytest,
  onNotice,
}: {
  draft: MedicalCase;
  updatedAt: string;
  takenSlugs: readonly string[];
  onChange: (next: MedicalCase) => void;
  onDelete: () => void;
  onPlaytest: () => void;
  onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("form");
  const issues = useMemo(() => inspectCase(draft), [draft]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const slugClash = takenSlugs.includes(draft.slug);

  const patch = (partial: Partial<MedicalCase>) => onChange({ ...draft, ...partial });

  async function copyModule() {
    const ok = await copyToClipboard(toTypeScriptModule(draft));
    onNotice(ok ? "TypeScript module copied." : "Clipboard unavailable; use Download instead.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <header className="clay-card bg-yellow-soft p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-ink-soft">
                {draft.slug || "new case"} · draft
              </p>
              <h2 className="mt-1 font-display text-2xl font-black md:text-3xl">
                {draft.title || "Untitled case"}
              </h2>
              <p className="mt-1 text-xs font-bold text-ink-soft">
                Autosaved in this browser · last edit {new Date(updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-1 rounded-full bg-card p-1 shadow-sm">
              {(["form", "json"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={tab === item}
                  onClick={() => setTab(item)}
                  className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === item ? "bg-[#168d91] text-white" : "text-ink-soft hover:bg-muted"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </header>

        {tab === "json" ? (
          <JsonEditor draft={draft} onChange={onChange} />
        ) : (
          <>
            <OverviewSection draft={draft} patch={patch} slugClash={slugClash} />
            <PatientSection draft={draft} patch={patch} />
            <VitalsSection draft={draft} patch={patch} />
            <DifferentialSection draft={draft} patch={patch} />
            <ActionsSection draft={draft} patch={patch} />
            <DeteriorationSection draft={draft} patch={patch} />
            <HintsSection draft={draft} patch={patch} />
            <SolutionSection draft={draft} patch={patch} />
            <ScoringSection draft={draft} patch={patch} />
            <AssetsSection draft={draft} patch={patch} />
          </>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="clay-card bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-black">Checks</h3>
            {errors.length ? (
              <Badge tone="bad">{errors.length} errors</Badge>
            ) : (
              <Badge tone="good">ready to export</Badge>
            )}
          </div>
          <div className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            <IssueList
              issues={[
                ...(slugClash
                  ? [
                      {
                        severity: "error",
                        path: "slug",
                        message: "This slug is already used by a shipped case.",
                      } satisfies StudioIssue,
                    ]
                  : []),
                ...errors,
              ]}
              compact
            />
            {warnings.length > 0 && <IssueList issues={warnings} compact />}
          </div>
        </div>
        <div className="clay-card bg-card p-4">
          <h3 className="font-display text-lg font-black">Actions</h3>
          <div className="mt-3 grid gap-2">
            <ToolButton
              onClick={onPlaytest}
              tone="primary"
              disabled={errors.length > 0}
              title={errors.length ? "Fix the errors first" : "Play the draft in the simulator"}
            >
              <Play className="size-4" /> Playtest
            </ToolButton>
            <ToolButton onClick={copyModule}>
              <Copy className="size-4" /> Copy TypeScript
            </ToolButton>
            <ToolButton
              onClick={() => downloadTextFile(exportFileName(draft), toTypeScriptModule(draft))}
            >
              <Download className="size-4" /> Download .ts module
            </ToolButton>
            <ToolButton
              onClick={() =>
                downloadTextFile("assets.manifest.json", toAssetManifest(draft), "application/json")
              }
            >
              <FileJson className="size-4" /> Download manifest
            </ToolButton>
            <ToolButton
              onClick={() =>
                downloadTextFile(
                  `${draft.slug || "case"}.json`,
                  JSON.stringify(draft, null, 2),
                  "application/json",
                )
              }
            >
              <FileJson className="size-4" /> Download JSON
            </ToolButton>
            <ToolButton onClick={onDelete} tone="danger">
              <Trash2 className="size-4" /> Delete draft
            </ToolButton>
          </div>
          <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            <li>
              Save the module as{" "}
              <code className="font-bold">
                src/features/case-challenge/cases/{exportFileName(draft)}
              </code>
              .
            </li>
            <li>Export it from that folder's index.ts.</li>
            <li>
              Put the manifest and any image files in{" "}
              <code className="font-bold">public/cases/{draft.slug || "<slug>"}/</code>.
            </li>
            <li>Run `npm test`, then request clinician review.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}

/* ---- Sections ------------------------------------------------------------ */

type SectionProps = { draft: MedicalCase; patch: (partial: Partial<MedicalCase>) => void };

function OverviewSection({ draft, patch, slugClash }: SectionProps & { slugClash: boolean }) {
  const introWords = draft.intro.trim() ? draft.intro.trim().split(/\s+/).length : 0;
  return (
    <SectionCard title="Overview" description="What the student sees in the library and the hook.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" className="md:col-span-2">
          <TextInput
            value={draft.title}
            onChange={(title) => patch({ title })}
            placeholder="The Long Flight"
          />
        </Field>
        <Field
          label="Slug"
          hint={
            slugClash ? "Already used by a shipped case." : "Stable authoring id, e.g. case_005."
          }
        >
          <TextInput value={draft.slug} onChange={(slug) => patch({ slug })} mono />
        </Field>
        <Field label="Case id (UUID)" hint="Used in URLs and saved progress; keep it stable.">
          <div className="flex gap-2">
            <TextInput value={draft.id} onChange={(id) => patch({ id })} mono />
            <button
              type="button"
              title="Generate a new id"
              onClick={() => patch({ id: newCaseId() })}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted hover:bg-lavender-soft"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </Field>
        <Field label="Difficulty">
          <SelectInput
            value={String(draft.difficulty) as "1" | "2" | "3"}
            onChange={(value) => patch({ difficulty: Number(value) as 1 | 2 | 3 })}
            options={[
              { value: "1", label: "Level 1 · foundation" },
              { value: "2", label: "Level 2 · clinical" },
              { value: "3", label: "Level 3 · advanced" },
            ]}
          />
        </Field>
        <Field label="Setting" hint="Shown on the patient card, e.g. “ER, 2:47 AM”.">
          <TextInput value={draft.setting} onChange={(setting) => patch({ setting })} />
        </Field>
        <Field label="Specialties" className="md:col-span-2">
          <TagInput
            value={draft.specialty}
            onChange={(specialty) => patch({ specialty })}
            placeholder="Add a specialty and press Enter"
            suggestions={SPECIALTY_SUGGESTIONS}
          />
        </Field>
        <Field
          label="Intro hook"
          hint={`${introWords}/40 words. Mid-scene, present tense.`}
          className="md:col-span-2"
        >
          <TextArea value={draft.intro} onChange={(intro) => patch({ intro })} rows={3} />
        </Field>
        <Field label="Review status">
          <SelectInput
            value={draft.reviewStatus}
            onChange={(reviewStatus) => patch({ reviewStatus })}
            options={[
              { value: "needs_clinician_review", label: "Needs clinician review" },
              { value: "clinician_reviewed", label: "Clinician reviewed" },
            ]}
          />
        </Field>
        <Field label="Mock comparison %" hint="Shown in the debrief as “students who solved it”.">
          <NumberInput
            value={draft.mockComparisonPercent}
            onChange={(value) => patch({ mockComparisonPercent: value ?? 0 })}
            min={0}
            max={100}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function PatientSection({ draft, patch }: SectionProps) {
  const patient = draft.patient;
  const set = (partial: Partial<MedicalCase["patient"]>) =>
    patch({ patient: { ...patient, ...partial } });
  const setAvatar = (partial: Partial<MedicalCase["patient"]["avatar"]>) =>
    set({ avatar: { ...patient.avatar, ...partial } });
  return (
    <SectionCard title="Patient" description="Identity, voice and the ward render.">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name">
          <TextInput value={patient.name} onChange={(name) => set({ name })} />
        </Field>
        <Field label="Age">
          <NumberInput value={patient.age} onChange={(age) => set({ age: age ?? 0 })} min={0} />
        </Field>
        <Field label="Sex" hint="Also picks the ward image unless a model is set.">
          <TextInput value={patient.sex} onChange={(sex) => set({ sex })} list="studio-sex" />
          <datalist id="studio-sex">
            <option value="Female" />
            <option value="Male" />
          </datalist>
        </Field>
        <Field label="Ward model">
          <SelectInput
            value={patient.model ?? "auto"}
            onChange={(value) => {
              const rest = omit(patient, "model");
              patch({
                patient: value === "auto" ? rest : { ...rest, model: value as "female" | "male" },
              });
            }}
            options={[
              { value: "auto", label: "Follow sex" },
              { value: "female", label: "Female ward" },
              { value: "male", label: "Male ward" },
            ]}
          />
        </Field>
        <Field label="Initial expression">
          <SelectInput
            value={patient.initialExpression}
            onChange={(initialExpression) => set({ initialExpression })}
            options={EXPRESSIONS}
          />
        </Field>
        <Field label="Age cues">
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
        <Field label="Skin tone">
          <TextInput
            value={patient.avatar.skinTone}
            onChange={(skinTone) => setAvatar({ skinTone })}
            mono
          />
        </Field>
        <Field label="Hair">
          <TextInput value={patient.avatar.hair} onChange={(hair) => setAvatar({ hair })} mono />
        </Field>
        <Field label="Outfit">
          <TextInput
            value={patient.avatar.outfit}
            onChange={(outfit) => setAvatar({ outfit })}
            mono
          />
        </Field>
        <Field label="Chief complaint" className="md:col-span-3">
          <TextInput
            value={patient.chiefComplaint}
            onChange={(chiefComplaint) => set({ chiefComplaint })}
          />
        </Field>
        <Field
          label="Personality / voice"
          hint="How replies sound; keep patient_reply results in this voice."
          className="md:col-span-3"
        >
          <TextArea
            value={patient.personality}
            onChange={(personality) => set({ personality })}
            rows={2}
          />
        </Field>
        <Field label="Presenting tags" className="md:col-span-3">
          <TagInput
            value={patient.presentingTags ?? []}
            onChange={(presentingTags) => set({ presentingTags })}
            placeholder="Short of breath, Chest pain…"
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function VitalsSection({ draft, patch }: SectionProps) {
  const rows = draft.vitalsTimeline;
  const setRow = (index: number, partial: Partial<VitalsSnapshot>) =>
    patch({
      vitalsTimeline: rows.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    });
  return (
    <SectionCard
      title="Vitals timeline"
      description="Reference states: arrival at minute 0, then what untreated deterioration looks like."
      badge={<Badge tone="neutral">{rows.length}</Badge>}
      action={
        <AddButton
          onClick={() =>
            patch({
              vitalsTimeline: [
                ...rows,
                {
                  ...(rows.at(-1) ?? { hr: 90, bp: "120/78", rr: 18, spo2: 97, temp: 37 }),
                  tMinute: (rows.at(-1)?.tMinute ?? 0) + 10,
                },
              ],
            })
          }
        >
          Snapshot
        </AddButton>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-ink-soft">
              <th className="pb-2 pr-2">Minute</th>
              <th className="pb-2 pr-2">HR</th>
              <th className="pb-2 pr-2">BP</th>
              <th className="pb-2 pr-2">RR</th>
              <th className="pb-2 pr-2">SpO₂</th>
              <th className="pb-2 pr-2">Temp</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="align-top">
                <td className="pb-2 pr-2">
                  <NumberInput
                    value={row.tMinute}
                    onChange={(v) => setRow(index, { tMinute: v ?? 0 })}
                    min={0}
                  />
                </td>
                <td className="pb-2 pr-2">
                  <NumberInput value={row.hr} onChange={(v) => setRow(index, { hr: v ?? 0 })} />
                </td>
                <td className="pb-2 pr-2">
                  <TextInput value={row.bp} onChange={(bp) => setRow(index, { bp })} mono />
                </td>
                <td className="pb-2 pr-2">
                  <NumberInput value={row.rr} onChange={(v) => setRow(index, { rr: v ?? 0 })} />
                </td>
                <td className="pb-2 pr-2">
                  <NumberInput value={row.spo2} onChange={(v) => setRow(index, { spo2: v ?? 0 })} />
                </td>
                <td className="pb-2 pr-2">
                  <NumberInput
                    value={row.temp}
                    step={0.1}
                    onChange={(v) => setRow(index, { temp: v ?? 0 })}
                  />
                </td>
                <td className="pb-2">
                  <RemoveButton
                    label="Remove snapshot"
                    onClick={() => patch({ vitalsTimeline: rows.filter((_, i) => i !== index) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function DifferentialSection({ draft, patch }: SectionProps) {
  const rows = draft.differential;
  const setRow = (index: number, partial: Partial<DifferentialDiagnosis>) =>
    patch({ differential: rows.map((row, i) => (i === index ? { ...row, ...partial } : row)) });
  return (
    <SectionCard
      title="Differential"
      description="Exactly one correct and exactly one tempting early anchor. Actions tag evidence to these ids."
      badge={<Badge tone="neutral">{rows.length}</Badge>}
      action={
        <AddButton
          onClick={() =>
            patch({
              differential: [...rows, { id: "", label: "", isCorrect: false, isTempting: false }],
            })
          }
        >
          Diagnosis
        </AddButton>
      }
    >
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl bg-muted p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto_auto]"
          >
            <TextInput
              value={row.id}
              onChange={(id) => setRow(index, { id: id.trim().replace(/\s+/g, "_").toLowerCase() })}
              placeholder="diagnosis_id"
              mono
            />
            <div className="md:hidden" />
            <div className="col-span-2 md:col-span-1">
              <TextInput
                value={row.label}
                onChange={(label) => setRow(index, { label })}
                placeholder="Label shown to students"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs font-black">
              <input
                type="radio"
                name="studio-correct"
                checked={row.isCorrect}
                onChange={() =>
                  patch({
                    differential: rows.map((item, i) => ({ ...item, isCorrect: i === index })),
                    solution: { ...draft.solution, diagnosisId: row.id },
                  })
                }
                className="accent-[#168d91]"
              />
              Correct
            </label>
            <label className="flex items-center gap-1.5 text-xs font-black">
              <input
                type="radio"
                name="studio-tempting"
                checked={row.isTempting}
                onChange={() =>
                  patch({
                    differential: rows.map((item, i) => ({ ...item, isTempting: i === index })),
                  })
                }
                className="accent-[#168d91]"
              />
              Tempting
            </label>
            <RemoveButton
              label="Remove diagnosis"
              onClick={() => patch({ differential: rows.filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Add the diagnoses students can commit to.</p>
        )}
      </div>
    </SectionCard>
  );
}

function ActionsSection({ draft, patch }: SectionProps) {
  const [category, setCategory] = useState<ActionCategory>("ask");
  const [openId, setOpenId] = useState<string | null>(null);
  const actions = draft.actions;
  const shown = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => action.category === category);
  const diagnosisOptions = draft.differential
    .filter((item) => item.id)
    .map((item) => ({ id: item.id, label: item.label || item.id }));
  const assetOptions = draft.assets.filter((asset) => asset.id).map((asset) => asset.id);

  const setAction = (index: number, next: CaseAction) =>
    patch({ actions: actions.map((action, i) => (i === index ? next : action)) });
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    patch({ actions: next });
  };
  const add = () => {
    const id = `${category}_${actions.filter((a) => a.category === category).length + 1}`;
    patch({ actions: [...actions, blankAction(category, id)] });
    setOpenId(id);
  };

  return (
    <SectionCard
      title="Actions"
      description="The game itself: ask, examine, test and treat. Each one costs time and returns evidence."
      badge={<Badge tone="neutral">{actions.length}</Badge>}
      action={<AddButton onClick={add}>{category} action</AddButton>}
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ACTION_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-black capitalize transition-colors ${category === item ? "bg-[#168d91] text-white" : "bg-muted hover:bg-lavender-soft"}`}
          >
            {item} · {actions.filter((a) => a.category === item).length}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {shown.map(({ action, index }) => {
          const open = openId === action.id;
          return (
            <div key={`${action.id}-${index}`} className="rounded-2xl bg-muted">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : action.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-black">
                    {action.label || <span className="text-muted-foreground">Untitled action</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {action.id || "no id"} · {action.timeCostMin} min
                    </span>
                    <ActionFlags action={action} />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(index, -1)}
                  className="grid size-8 place-items-center rounded-full hover:bg-card"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(index, 1)}
                  className="grid size-8 place-items-center rounded-full hover:bg-card"
                >
                  <ArrowDown className="size-4" />
                </button>
                <RemoveButton
                  label="Remove action"
                  onClick={() => patch({ actions: actions.filter((_, i) => i !== index) })}
                />
              </div>
              {open && (
                <div className="border-t border-border/70 p-3">
                  <ActionEditor
                    action={action}
                    diagnosisOptions={diagnosisOptions}
                    assetOptions={assetOptions}
                    allActionIds={actions.map((a) => a.id).filter((id) => id && id !== action.id)}
                    onChange={(next) => {
                      setAction(index, next);
                      if (next.id !== action.id) setOpenId(next.id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">No {category} actions yet.</p>
        )}
      </div>
    </SectionCard>
  );
}

function ActionEditor({
  action,
  diagnosisOptions,
  assetOptions,
  allActionIds,
  onChange,
}: {
  action: CaseAction;
  diagnosisOptions: { id: string; label: string }[];
  assetOptions: string[];
  allActionIds: string[];
  onChange: (next: CaseAction) => void;
}) {
  const set = (partial: Partial<CaseAction>) => onChange({ ...action, ...partial });
  const setResult = (partial: Partial<CaseActionResult>) =>
    set({ result: { ...action.result, ...partial } });
  const setFlag = (key: keyof CaseAction, value: boolean) => {
    const next: Record<string, unknown> = { ...action };
    if (value) next[key] = true;
    else delete next[key];
    onChange(next as unknown as CaseAction);
  };
  const vitalsEffect = action.vitalsEffect ?? {};
  const setVital = (key: keyof VitalsDelta, value: number | undefined) => {
    const next: VitalsDelta = { ...vitalsEffect };
    if (value === undefined || value === 0) delete next[key];
    else next[key] = value;
    if (Object.keys(next).length) set({ vitalsEffect: next });
    else onChange(omit(action, "vitalsEffect"));
  };
  const labs = action.result.labs ?? [];
  const setLab = (index: number, partial: Partial<LabRow>) =>
    setResult({ labs: labs.map((row, i) => (i === index ? { ...row, ...partial } : row)) });

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label="Id" className="md:col-span-2">
        <TextInput
          value={action.id}
          onChange={(id) => set({ id: id.trim().replace(/\s+/g, "_").toLowerCase() })}
          mono
        />
      </Field>
      <Field label="Category">
        <SelectInput
          value={action.category}
          onChange={(category) => set({ category })}
          options={ACTION_CATEGORIES.map((value) => ({ value, label: value }))}
        />
      </Field>
      <Field label="Clue tier">
        <SelectInput
          value={action.clueTier}
          onChange={(clueTier) => set({ clueTier })}
          options={CLUE_TIERS.map((value) => ({ value, label: value.replace("_", " ") }))}
        />
      </Field>
      <Field label="Label" className="md:col-span-4">
        <TextInput value={action.label} onChange={(label) => set({ label })} />
      </Field>
      <Field label="Minutes">
        <NumberInput
          value={action.timeCostMin}
          onChange={(v) => set({ timeCostMin: v ?? 0 })}
          min={0}
        />
      </Field>
      <Field label="Cost ($)">
        <NumberInput
          value={action.moneyCost}
          onChange={(v) => set({ moneyCost: v ?? 0 })}
          min={0}
        />
      </Field>
      <Field label="Risk note" className="md:col-span-2">
        <TextInput value={action.riskNote} onChange={(riskNote) => set({ riskNote })} />
      </Field>
      <Field label="Result type">
        <SelectInput
          value={action.result.type}
          onChange={(type) => setResult({ type })}
          options={RESULT_TYPES.map((value) => ({ value, label: value.replace("_", " ") }))}
        />
      </Field>
      {action.result.type === "ecg" && (
        <Field label="ECG preset">
          <SelectInput
            value={action.result.ecg?.preset ?? ""}
            onChange={(preset) => setResult({ ecg: { preset } })}
            placeholder="Choose a tracing"
            options={ECG_PRESETS.map((value) => ({ value, label: value }))}
          />
        </Field>
      )}
      {(action.result.type === "image" || action.result.type === "ecg") && (
        <Field label="Asset id">
          <SelectInput
            value={action.result.assetId ?? ""}
            onChange={(assetId) =>
              assetId ? setResult({ assetId }) : set({ result: omit(action.result, "assetId") })
            }
            placeholder={assetOptions.length ? "Choose an asset" : "No assets defined"}
            options={[
              { value: "", label: "None" },
              ...assetOptions.map((id) => ({ value: id, label: id })),
            ]}
          />
        </Field>
      )}
      <Field
        label="Result text"
        hint="Live tokens: {hr} {bp} {sbp} {dbp} {rr} {spo2} {temp} {rhythm}, with offsets like {sbp-20}."
        className="md:col-span-4"
      >
        <TextArea
          value={action.result.content}
          onChange={(content) => setResult({ content })}
          rows={3}
        />
      </Field>
      {action.result.type === "lab_table" && (
        <div className="md:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-ink-soft">
              Lab rows
            </span>
            <AddButton
              onClick={() =>
                setResult({
                  labs: [...labs, { test: "", result: "", reference: "", flag: "normal" }],
                })
              }
            >
              Row
            </AddButton>
          </div>
          <div className="space-y-2">
            {labs.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] gap-2"
              >
                <TextInput
                  value={row.test}
                  onChange={(test) => setLab(index, { test })}
                  placeholder="Test"
                />
                <TextInput
                  value={row.result}
                  onChange={(result) => setLab(index, { result })}
                  placeholder="Result"
                />
                <TextInput
                  value={row.reference ?? ""}
                  onChange={(reference) => setLab(index, { reference })}
                  placeholder="Reference"
                />
                <SelectInput
                  value={row.flag ?? "normal"}
                  onChange={(flag) => setLab(index, { flag })}
                  options={(["normal", "high", "low", "critical"] as const).map((value) => ({
                    value,
                    label: value,
                  }))}
                />
                <RemoveButton
                  label="Remove row"
                  onClick={() => setResult({ labs: labs.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Supports" className="md:col-span-2">
        <ChipSelect
          options={diagnosisOptions}
          value={action.supports}
          onChange={(supports) => set({ supports })}
          emptyLabel="Add diagnoses to the differential first."
        />
      </Field>
      <Field label="Against" className="md:col-span-2">
        <ChipSelect
          options={diagnosisOptions}
          value={action.against}
          onChange={(against) => set({ against })}
          emptyLabel="Add diagnoses to the differential first."
        />
      </Field>
      <div className="grid gap-1 md:col-span-2">
        <Checkbox
          checked={!!action.isKeyClue}
          onChange={(v) => setFlag("isKeyClue", v)}
          label="Key clue"
          hint="Counted in the debrief; earns the early-clue bonus."
        />
        <Checkbox
          checked={!!action.isCritical}
          onChange={(v) => setFlag("isCritical", v)}
          label="Critical (stabilising)"
        />
        <Checkbox
          checked={!!action.isUnnecessary}
          onChange={(v) => setFlag("isUnnecessary", v)}
          label="Unnecessary test"
          hint="Penalised per use."
        />
      </div>
      <div className="grid gap-1 md:col-span-2">
        <Checkbox
          checked={!!action.harmful}
          onChange={(v) => setFlag("harmful", v)}
          label="Harmful"
          hint="Always penalised; needs a debrief line."
        />
        <Checkbox
          checked={!!action.immediateFailure}
          onChange={(v) => setFlag("immediateFailure", v)}
          label="Immediate failure"
          hint="Ends the case with the patient lost."
        />
        <Checkbox
          checked={!!action.penalizeWhenUnsafe}
          onChange={(v) => setFlag("penalizeWhenUnsafe", v)}
          label="Penalise when unsafe"
          hint="Harmful only when the safety gate below is not met."
        />
      </div>
      <Field
        label="Triggers event"
        hint="Optional key recorded on the timeline."
        className="md:col-span-2"
      >
        <TextInput
          value={action.triggersEvent}
          onChange={(triggersEvent) => set({ triggersEvent })}
          mono
        />
      </Field>
      <div className="md:col-span-2">
        <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
          Vitals effect (delta)
        </span>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {VITAL_KEYS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="block text-[10px] font-bold text-muted-foreground">{label}</span>
              <NumberInput
                value={vitalsEffect[key]}
                onChange={(value) => setVital(key, value)}
                step={key === "temp" ? 0.1 : 1}
                allowEmpty
              />
            </label>
          ))}
        </div>
      </div>
      <SafetyGateEditor action={action} allActionIds={allActionIds} onChange={onChange} />
      <JsonSubEditor
        label="State variants (advanced JSON)"
        hint="Array of { when, result, vitalsEffect? }. Leave empty for none."
        value={action.variants}
        onChange={(variants) =>
          variants === undefined
            ? onChange(omit(action, "variants"))
            : set({ variants: variants as ResultVariant[] })
        }
      />
      <JsonSubEditor
        label="Annotation (advanced JSON)"
        hint="{ xPercent, yPercent, radiusPercent, label } for the debrief answer ring."
        value={action.result.annotation}
        onChange={(annotation) =>
          annotation === undefined
            ? set({ result: omit(action.result, "annotation") })
            : setResult({ annotation: annotation as NonNullable<CaseActionResult["annotation"]> })
        }
      />
    </div>
  );
}

function SafetyGateEditor({
  action,
  allActionIds,
  onChange,
}: {
  action: CaseAction;
  allActionIds: string[];
  onChange: (next: CaseAction) => void;
}) {
  const gate = action.safeWhen;
  const options = allActionIds.map((id) => ({ id, label: id }));
  if (!gate) {
    return (
      <div className="md:col-span-4">
        <AddButton
          onClick={() => onChange({ ...action, safeWhen: { explanation: "", anyActionIds: [] } })}
        >
          Safety gate
        </AddButton>
      </div>
    );
  }
  const set = (partial: Partial<ActionSafetyGate>) =>
    onChange({ ...action, safeWhen: { ...gate, ...partial } });
  const threshold = gate.supportingActionThreshold;
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border p-3 md:col-span-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-ink-soft">
          Safety gate
        </span>
        <RemoveButton
          label="Remove safety gate"
          onClick={() => onChange(omit(action, "safeWhen"))}
        />
      </div>
      <Field label="Explanation" hint="Shown on the timeline when the gate is not met.">
        <TextInput value={gate.explanation} onChange={(explanation) => set({ explanation })} />
      </Field>
      <Field label="All of these must be done first">
        <ChipSelect
          options={options}
          value={gate.allActionIds ?? []}
          onChange={(allActionIds) => set({ allActionIds })}
        />
      </Field>
      <Field label="…and any one of these">
        <ChipSelect
          options={options}
          value={gate.anyActionIds ?? []}
          onChange={(anyActionIds) => set({ anyActionIds })}
        />
      </Field>
      <Field label="…or at least N of these supporting actions">
        <div className="space-y-2">
          <ChipSelect
            options={options}
            value={threshold?.actionIds ?? []}
            onChange={(actionIds) =>
              actionIds.length
                ? set({
                    supportingActionThreshold: {
                      actionIds,
                      minimumCompleted:
                        Math.min(threshold?.minimumCompleted ?? 1, actionIds.length) || 1,
                    },
                  })
                : onChange({ ...action, safeWhen: omit(gate, "supportingActionThreshold") })
            }
          />
          {threshold && (
            <div className="max-w-[10rem]">
              <NumberInput
                value={threshold.minimumCompleted}
                min={1}
                max={threshold.actionIds.length}
                onChange={(minimumCompleted) =>
                  set({
                    supportingActionThreshold: {
                      ...threshold,
                      minimumCompleted: minimumCompleted ?? 1,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      </Field>
    </div>
  );
}

/** JSON text for the parts of an action that are rare enough not to deserve a form. */
function JsonSubEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    setText(value === undefined ? "" : JSON.stringify(value, null, 2));
    setError("");
  }, [value]);
  function apply() {
    if (!text.trim()) {
      setError("");
      if (value !== undefined) onChange(undefined);
      return;
    }
    try {
      onChange(JSON.parse(text));
      setError("");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON");
    }
  }
  return (
    <Field label={label} hint={error || hint} className="md:col-span-4">
      <TextArea value={text} onChange={setText} rows={text ? 6 : 2} mono />
      {text !== (value === undefined ? "" : JSON.stringify(value, null, 2)) && (
        <button
          type="button"
          onClick={apply}
          className="mt-2 rounded-full bg-[#168d91] px-3 py-1.5 text-xs font-black text-white"
        >
          Apply JSON
        </button>
      )}
    </Field>
  );
}

function DeteriorationSection({ draft, patch }: SectionProps) {
  const rules = draft.deteriorationRules;
  const treatOptions = draft.actions
    .filter((action) => action.id)
    .map((action) => ({
      value: action.id,
      label: `${action.label || action.id} (${action.category})`,
    }));
  const setRule = (index: number, partial: Partial<DeteriorationRule>) =>
    patch({
      deteriorationRules: rules.map((rule, i) => (i === index ? { ...rule, ...partial } : rule)),
    });
  return (
    <SectionCard
      title="Deterioration rules"
      description="What happens when a time-critical action is missed; lossAtMinute ends the case."
      badge={<Badge tone="neutral">{rules.length}</Badge>}
      action={
        <AddButton
          onClick={() =>
            patch({
              deteriorationRules: [
                ...rules,
                {
                  id: `rule_${rules.length + 1}`,
                  ifNotDoneBy: 10,
                  action: "",
                  effect: {},
                  alertLine: "",
                  source: "nurse",
                  triggersEvent: "",
                },
              ],
            })
          }
        >
          Rule
        </AddButton>
      }
    >
      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div key={index} className="grid gap-3 rounded-2xl bg-muted p-3 md:grid-cols-4">
            <Field label="Rule id">
              <TextInput value={rule.id} onChange={(id) => setRule(index, { id })} mono />
            </Field>
            <Field label="Prevented by action" className="md:col-span-2">
              <SelectInput
                value={rule.action}
                onChange={(action) => setRule(index, { action })}
                placeholder="Choose an action"
                options={treatOptions}
              />
            </Field>
            <div className="flex items-end justify-end">
              <RemoveButton
                label="Remove rule"
                onClick={() => patch({ deteriorationRules: rules.filter((_, i) => i !== index) })}
              />
            </div>
            <Field label="Fires if not done by (min)">
              <NumberInput
                value={rule.ifNotDoneBy}
                onChange={(v) => setRule(index, { ifNotDoneBy: v ?? 0 })}
                min={0}
              />
            </Field>
            <Field label="Patient lost at (min)" hint="Leave empty if survivable.">
              <NumberInput
                value={rule.lossAtMinute}
                onChange={(lossAtMinute) =>
                  patch({
                    deteriorationRules: rules.map((item, i) =>
                      i !== index
                        ? item
                        : lossAtMinute === undefined
                          ? omit(item, "lossAtMinute")
                          : { ...item, lossAtMinute },
                    ),
                  })
                }
                min={0}
                allowEmpty
              />
            </Field>
            <Field label="Alert source">
              <SelectInput
                value={rule.source}
                onChange={(source) => setRule(index, { source })}
                options={[
                  { value: "nurse", label: "Nurse" },
                  { value: "patient", label: "Patient" },
                  { value: "monitor", label: "Monitor" },
                ]}
              />
            </Field>
            <Field label="Triggers event">
              <TextInput
                value={rule.triggersEvent}
                onChange={(triggersEvent) => setRule(index, { triggersEvent })}
                mono
              />
            </Field>
            <Field label="Alert line" className="md:col-span-4">
              <TextInput
                value={rule.alertLine}
                onChange={(alertLine) => setRule(index, { alertLine })}
              />
            </Field>
            <div className="md:col-span-4">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                Vitals effect (delta)
              </span>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                {VITAL_KEYS.map(({ key, label }) => (
                  <label key={key} className="block">
                    <span className="block text-[10px] font-bold text-muted-foreground">
                      {label}
                    </span>
                    <NumberInput
                      value={rule.effect[key]}
                      step={key === "temp" ? 0.1 : 1}
                      allowEmpty
                      onChange={(value) => {
                        const effect: VitalsDelta = { ...rule.effect };
                        if (value === undefined || value === 0) delete effect[key];
                        else effect[key] = value;
                        setRule(index, { effect });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No rules yet. Time-critical cases need at least one.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function HintsSection({ draft, patch }: SectionProps) {
  return (
    <SectionCard
      title="Hints"
      description="Three escalating nudges from Dr. Ambrose; tier 1 is free."
    >
      <div className="space-y-3">
        {draft.hints.map((hint, index) => (
          <div key={hint.tier} className="grid gap-2 md:grid-cols-[6rem_minmax(0,1fr)]">
            <Field label={`Tier ${hint.tier} cost`}>
              <NumberInput
                value={hint.cost}
                min={0}
                onChange={(cost) =>
                  patch({
                    hints: draft.hints.map((item, i) =>
                      i === index ? { ...item, cost: cost ?? 0 } : item,
                    ) as MedicalCase["hints"],
                  })
                }
              />
            </Field>
            <Field label="Text">
              <TextArea
                value={hint.text}
                rows={2}
                onChange={(text) =>
                  patch({
                    hints: draft.hints.map((item, i) =>
                      i === index ? { ...item, text } : item,
                    ) as MedicalCase["hints"],
                  })
                }
              />
            </Field>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SolutionSection({ draft, patch }: SectionProps) {
  const solution = draft.solution;
  const set = (partial: Partial<MedicalCase["solution"]>) =>
    patch({ solution: { ...solution, ...partial } });
  const treatOptions = draft.actions
    .filter((action) => action.category === "treat" && action.id)
    .map((action) => ({ id: action.id, label: action.label || action.id }));
  const harmful = draft.actions.filter((action) => action.harmful && action.id);
  return (
    <SectionCard
      title="Solution & debrief"
      description="What the debrief teaches once the case ends."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Diagnosis (full wording)" className="md:col-span-2">
          <TextInput value={solution.diagnosis} onChange={(diagnosis) => set({ diagnosis })} />
        </Field>
        <Field label="Correct differential id">
          <SelectInput
            value={solution.diagnosisId}
            onChange={(diagnosisId) => set({ diagnosisId })}
            placeholder="Choose the correct diagnosis"
            options={draft.differential
              .filter((item) => item.id)
              .map((item) => ({ value: item.id, label: item.label || item.id }))}
          />
        </Field>
        <Field
          label="Key treatment actions"
          hint="Each one missed costs the per-missed-treatment penalty."
        >
          <ChipSelect
            options={treatOptions}
            value={solution.keyTreatment}
            onChange={(keyTreatment) => set({ keyTreatment })}
            emptyLabel="Add treat actions first."
          />
        </Field>
        {solution.teachingPoints.map((point, index) => (
          <Field key={index} label={`Teaching point ${index + 1}`} className="md:col-span-2">
            <TextArea
              value={point}
              rows={2}
              onChange={(text) =>
                set({
                  teachingPoints: solution.teachingPoints.map((item, i) =>
                    i === index ? text : item,
                  ) as MedicalCase["solution"]["teachingPoints"],
                })
              }
            />
          </Field>
        ))}
        <Field label="Why the tempting diagnosis fails" className="md:col-span-2">
          <TextArea
            value={solution.whyNotTempting}
            rows={3}
            onChange={(whyNotTempting) => set({ whyNotTempting })}
          />
        </Field>
        <div className="md:col-span-2">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
            Harmful action debriefs
          </span>
          {harmful.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mark actions as harmful and their debrief lines appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {harmful.map((action) => (
                <Field key={action.id} label={action.label || action.id}>
                  <TextArea
                    value={solution.harmfulActionDebrief[action.id] ?? ""}
                    rows={2}
                    onChange={(text) =>
                      set({
                        harmfulActionDebrief: {
                          ...solution.harmfulActionDebrief,
                          [action.id]: text,
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

const SCORING_FIELDS: readonly {
  key: keyof MedicalCase["scoring"];
  label: string;
  hint: string;
}[] = [
  { key: "base", label: "Base score", hint: "Positive." },
  { key: "perMinutePenaltyAfter", label: "Free minutes", hint: "Time penalty starts after this." },
  { key: "perMinutePenalty", label: "Per minute", hint: "Negative." },
  { key: "perUnnecessaryTest", label: "Per unnecessary test", hint: "Negative." },
  { key: "perHarmfulAction", label: "Per harmful action", hint: "Negative." },
  { key: "bonusKeyClueFoundEarly", label: "Early-clue bonus", hint: "Positive." },
  { key: "earlyClueCutoffMinute", label: "Early-clue cutoff (min)", hint: "" },
  { key: "incorrectDiagnosisPenalty", label: "Wrong diagnosis", hint: "Negative." },
  { key: "perMissedKeyTreatment", label: "Per missed key treatment", hint: "Negative." },
];

function ScoringSection({ draft, patch }: SectionProps) {
  return (
    <SectionCard
      title="Scoring"
      description="Penalties are negative, bonuses positive."
      defaultOpen={false}
    >
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {SCORING_FIELDS.map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint}>
            <NumberInput
              value={draft.scoring[key]}
              onChange={(value) => patch({ scoring: { ...draft.scoring, [key]: value ?? 0 } })}
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

function AssetsSection({ draft, patch }: SectionProps) {
  const assets = draft.assets;
  const setAsset = (index: number, partial: Partial<CaseAsset>) =>
    patch({ assets: assets.map((asset, i) => (i === index ? { ...asset, ...partial } : asset)) });
  return (
    <SectionCard
      title="Assets"
      description="Open-licensed images referenced by image results. Files go in public/cases/<slug>/."
      badge={<Badge tone="neutral">{assets.length}</Badge>}
      defaultOpen={assets.length > 0}
      action={
        <AddButton
          onClick={() =>
            patch({
              assets: [
                ...assets,
                {
                  id: "",
                  filename: "",
                  sourceUrl: "",
                  author: "",
                  license: "",
                  requiredAttributionText: "",
                  altText: "",
                  isPlaceholder: false,
                },
              ],
            })
          }
        >
          Asset
        </AddButton>
      }
    >
      <div className="space-y-3">
        {assets.map((asset, index) => (
          <div key={index} className="grid gap-3 rounded-2xl bg-muted p-3 md:grid-cols-2">
            <Field label="Asset id">
              <TextInput value={asset.id} onChange={(id) => setAsset(index, { id })} mono />
            </Field>
            <div className="flex items-start gap-2">
              <Field label="Filename" className="flex-1">
                <TextInput
                  value={asset.filename}
                  onChange={(filename) => setAsset(index, { filename })}
                  mono
                />
              </Field>
              <div className="pt-5">
                <RemoveButton
                  label="Remove asset"
                  onClick={() => patch({ assets: assets.filter((_, i) => i !== index) })}
                />
              </div>
            </div>
            <Field label="Source URL" className="md:col-span-2">
              <TextInput
                value={asset.sourceUrl}
                onChange={(sourceUrl) => setAsset(index, { sourceUrl })}
              />
            </Field>
            <Field label="Author">
              <TextInput value={asset.author} onChange={(author) => setAsset(index, { author })} />
            </Field>
            <Field label="License">
              <TextInput
                value={asset.license}
                onChange={(license) => setAsset(index, { license })}
              />
            </Field>
            <Field label="Required attribution text" className="md:col-span-2">
              <TextInput
                value={asset.requiredAttributionText}
                onChange={(requiredAttributionText) => setAsset(index, { requiredAttributionText })}
              />
            </Field>
            <Field label="Alt text" className="md:col-span-2">
              <TextInput
                value={asset.altText}
                onChange={(altText) => setAsset(index, { altText })}
              />
            </Field>
            <Checkbox
              checked={asset.isPlaceholder}
              onChange={(isPlaceholder) => setAsset(index, { isPlaceholder })}
              label="Placeholder (licence unconfirmed)"
            />
          </div>
        ))}
        {assets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Generated ECGs need no asset. Add one only for radiology or clinical photographs.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function JsonEditor({
  draft,
  onChange,
}: {
  draft: MedicalCase;
  onChange: (next: MedicalCase) => void;
}) {
  const serialized = useMemo(() => JSON.stringify(draft, null, 2), [draft]);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState("");
  useEffect(() => {
    setText(serialized);
    setError("");
  }, [serialized]);
  function apply() {
    try {
      onChange(parseCaseJson(text));
      setError("");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON");
    }
  }
  return (
    <SectionCard
      title="Source"
      description="The whole definition as JSON. Paste a case here, or hand-edit anything the form does not cover."
      action={
        <ToolButton onClick={apply} tone="primary" disabled={text === serialized}>
          Apply changes
        </ToolButton>
      }
    >
      {error && (
        <pre className="mb-3 whitespace-pre-wrap rounded-2xl bg-pink-soft p-3 font-mono text-xs text-[#7b1f1f]">
          {error}
        </pre>
      )}
      <TextArea value={text} onChange={setText} rows={28} mono />
    </SectionCard>
  );
}
