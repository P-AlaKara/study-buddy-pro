import { useId, useRef, useState, type PointerEvent } from "react";
import { Crosshair, ImagePlus, Trash2 } from "lucide-react";
import { ecgDataUrl } from "@/features/case-challenge/ecg";
import { interpolateVitals } from "@/features/case-challenge/engine";
import {
  ECG_PRESETS,
  type ActionCategory,
  type CaseActionResult,
  type LabRow,
  type MedicalCase,
  type ResultType,
} from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import { initialVitals } from "../../case-analysis";
import {
  CATEGORY_META,
  ECG_META,
  LAB_FLAG_META,
  LIVE_TOKENS,
  RESULT_META,
  RESULT_TYPES_FOR,
} from "../../vocabulary";
import { assetSources, useFirstImage, useResultImage } from "../media";
import {
  Button,
  ChoiceCards,
  Field,
  FOCUS_RING,
  IconButton,
  SelectInput,
  TextArea,
  TextInput,
} from "../studio-ui";
import { AddRow } from "./small-editors";

/* ---- Response text with live values -------------------------------------- */

export function ResponseTextField({
  definition,
  category,
  value,
  onChange,
  label,
  anchor,
}: {
  definition: MedicalCase;
  category: ActionCategory;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  anchor?: string;
}) {
  const meta = CATEGORY_META[category];
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const start = initialVitals(definition);
  const hasTokens = /\{\w+([+-]\d+)?\}/.test(value);

  function insert(token: string) {
    const element = ref.current;
    if (!element) {
      onChange(`${value}${token}`);
      return;
    }
    const from = element.selectionStart ?? value.length;
    const to = element.selectionEnd ?? value.length;
    const next = `${value.slice(0, from)}${token}${value.slice(to)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(from + token.length, from + token.length);
    });
  }

  return (
    <Field
      label={label ?? meta.responseLabel}
      required
      help={meta.responseHelp}
      {...(anchor ? { anchor } : {})}
    >
      <TextArea value={value} onChange={onChange} rows={4} textareaRef={ref} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-bold text-muted-foreground">Insert a live value:</span>
        {LIVE_TOKENS.map((item) => (
          <button
            key={item.token}
            type="button"
            onClick={() => insert(item.token)}
            className={cn(
              "rounded-full bg-blue-soft px-2.5 py-1 text-xs font-extrabold text-[#1d4a85] hover:bg-[#dbe9fb]",
              FOCUS_RING,
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Live values are filled in with the patient's observations at the moment the student sees the
        response, so they stay correct as the patient changes.
      </p>
      {hasTokens && start && (
        <p className="mt-2 rounded-xl bg-muted/70 px-3 py-2 text-[13px]">
          <span className="font-bold">On arrival this reads:</span>{" "}
          {interpolateVitals(value, start)}
        </p>
      )}
    </Field>
  );
}

/* ---- Lab rows ---------------------------------------------------------- */

export function LabRowsEditor({
  rows,
  onChange,
}: {
  rows: readonly LabRow[];
  onChange: (rows: LabRow[]) => void;
}) {
  const set = (index: number, partial: Partial<LabRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...partial } : row)));
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_2.25rem] gap-2 px-1 text-[13px] font-bold text-muted-foreground md:grid">
        <span>Test</span>
        <span>Result (with units)</span>
        <span>Reference range</span>
        <span>Flag</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_2.25rem] md:bg-transparent md:p-0"
        >
          <TextInput
            value={row.test}
            onChange={(test) => set(index, { test })}
            placeholder="e.g. D-dimer"
            ariaLabel={`Row ${index + 1} test`}
            className="col-span-2 md:col-span-1"
          />
          <TextInput
            value={row.result}
            onChange={(result) => set(index, { result })}
            placeholder="e.g. 3,480 ng/mL"
            ariaLabel={`Row ${index + 1} result`}
          />
          <TextInput
            value={row.reference ?? ""}
            onChange={(reference) => set(index, { reference })}
            placeholder="e.g. <500"
            ariaLabel={`Row ${index + 1} reference range`}
          />
          <SelectInput
            value={row.flag ?? "normal"}
            onChange={(flag) => set(index, { flag })}
            ariaLabel={`Row ${index + 1} flag`}
            options={(["normal", "high", "low", "critical"] as const).map((value) => ({
              value,
              label: `${LAB_FLAG_META[value].label}${LAB_FLAG_META[value].symbol ? ` ${LAB_FLAG_META[value].symbol}` : ""}`,
            }))}
          />
          <IconButton
            label={`Remove row ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      ))}
      <AddRow
        onClick={() => onChange([...rows, { test: "", result: "", reference: "", flag: "normal" }])}
      >
        Add a result row
      </AddRow>
    </div>
  );
}

/* ---- ECG ----------------------------------------------------------------- */

export function EcgPicker({
  value,
  onChange,
  heartRate,
}: {
  value: string | undefined;
  onChange: (preset: (typeof ECG_PRESETS)[number]) => void;
  heartRate: number;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label="ECG pattern"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
    >
      {ECG_PRESETS.map((preset) => {
        const active = value === preset;
        return (
          <label
            key={preset}
            className={cn(
              "cursor-pointer overflow-hidden rounded-2xl border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7c63e0]",
              active
                ? "border-[#7c63e0] bg-lavender-soft"
                : "border-border bg-card hover:bg-muted/60",
            )}
          >
            <img
              src={ecgDataUrl({ preset, heartRate })}
              alt=""
              className="block aspect-[4/3] w-full bg-white object-cover object-left-top"
              loading="lazy"
            />
            <span className="flex items-start gap-2 p-3">
              <input
                type="radio"
                name={name}
                checked={active}
                onChange={() => onChange(preset)}
                className="mt-1 size-4 shrink-0 accent-[#5a44b5]"
              />
              <span>
                <span className="block text-sm font-extrabold">{ECG_META[preset].label}</span>
                <span className="block text-[13px] leading-snug text-muted-foreground">
                  {ECG_META[preset].description}
                </span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ---- Images ------------------------------------------------------------- */

function AssetOption({
  definition,
  assetId,
  active,
  onSelect,
}: {
  definition: MedicalCase;
  assetId: string;
  active: boolean;
  onSelect: () => void;
}) {
  const asset = definition.assets.find((item) => item.id === assetId);
  const { status, src } = useFirstImage(assetSources(definition, asset));
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "overflow-hidden rounded-2xl border text-left transition-colors",
        FOCUS_RING,
        active ? "border-[#7c63e0] ring-2 ring-[#7c63e0]" : "border-border hover:border-[#b9acdf]",
      )}
    >
      {status === "ok" && src ? (
        <img src={src} alt="" className="block aspect-[4/3] w-full bg-[#151f29] object-contain" />
      ) : (
        <span className="grid aspect-[4/3] w-full place-items-center bg-muted text-center text-xs font-bold text-muted-foreground">
          {status === "loading" ? "Loading…" : "Not uploaded yet"}
        </span>
      )}
      <span className="block truncate px-2.5 py-2 text-[13px] font-bold">
        {asset?.altText || asset?.filename || "Untitled image"}
      </span>
    </button>
  );
}

export function ImagePicker({
  definition,
  value,
  onChange,
  onAddImage,
}: {
  definition: MedicalCase;
  value: string | undefined;
  onChange: (assetId: string) => void;
  onAddImage: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {definition.assets.map((asset) => (
          <AssetOption
            key={asset.id}
            definition={definition}
            assetId={asset.id}
            active={value === asset.id}
            onSelect={() => onChange(asset.id)}
          />
        ))}
        <button
          type="button"
          onClick={onAddImage}
          className={cn(
            "grid aspect-[4/3] place-items-center rounded-2xl border-2 border-dashed border-[#b9acdf] text-center text-[13px] font-extrabold text-[#4a3799] hover:bg-lavender-soft",
            FOCUS_RING,
          )}
        >
          <span>
            <ImagePlus aria-hidden className="mx-auto mb-1 size-6" />
            Add a new image
          </span>
        </button>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Add an image here or in the case's image library (Tests step). Use open-licensed images with
        teaching labels removed.
      </p>
    </div>
  );
}

/** Click on the picture to place the ring students see in the debrief. */
export function MarkerEditor({
  definition,
  result,
  onChange,
}: {
  definition: MedicalCase;
  result: CaseActionResult;
  onChange: (annotation: CaseActionResult["annotation"] | undefined) => void;
}) {
  const start = initialVitals(definition);
  const { media, image } = useResultImage(definition, result, start?.hr);
  const status = image.status;
  const [placing, setPlacing] = useState(false);
  const annotation = result.annotation;
  if (!media || status !== "ok") {
    return (
      <p className="text-[13px] text-muted-foreground">
        Once the picture is available you can mark the key finding on it for the debrief.
      </p>
    );
  }

  function place(event: PointerEvent<HTMLDivElement>) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    onChange({
      xPercent: Math.round(((event.clientX - box.left) / box.width) * 100),
      yPercent: Math.round(((event.clientY - box.top) / box.height) * 100),
      radiusPercent: annotation?.radiusPercent ?? 12,
      label: annotation?.label ?? "",
    });
    setPlacing(false);
  }

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
      <div
        onPointerDown={place}
        className={cn(
          "relative overflow-hidden rounded-2xl bg-[#151f29]",
          placing ? "cursor-crosshair ring-4 ring-amber-300" : "",
        )}
      >
        <img
          src={media.src}
          alt={media.altText}
          className="block w-full select-none"
          draggable={false}
        />
        {annotation && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300 bg-amber-300/10"
            style={{
              left: `${annotation.xPercent}%`,
              top: `${annotation.yPercent}%`,
              width: `${annotation.radiusPercent * 2}%`,
              aspectRatio: "1",
            }}
          />
        )}
        {placing && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-extrabold text-white">
            Click the finding
          </span>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          After the case, students see a ring around the key finding. Optional.
        </p>
        <Button
          size="sm"
          tone={placing ? "primary" : "quiet"}
          onClick={() => setPlacing((value) => !value)}
        >
          <Crosshair aria-hidden className="size-4" />
          {placing ? "Cancel placing" : annotation ? "Move the ring" : "Place the ring"}
        </Button>
        {annotation && (
          <>
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold">Ring size</span>
              <input
                type="range"
                min={3}
                max={50}
                value={annotation.radiusPercent}
                onChange={(event) =>
                  onChange({ ...annotation, radiusPercent: Number(event.target.value) })
                }
                className="w-full accent-[#5a44b5]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold">What it marks</span>
              <TextInput
                value={annotation.label}
                onChange={(label) => onChange({ ...annotation, label })}
                placeholder="e.g. Widened mediastinum"
              />
            </label>
            <Button size="sm" tone="danger" onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden className="size-4" /> Remove the ring
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Whole response -------------------------------------------------------- */

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export function ResponseEditor({
  definition,
  category,
  result,
  onChange,
  onAddImage,
  anchor,
}: {
  definition: MedicalCase;
  category: ActionCategory;
  result: CaseActionResult;
  onChange: (result: CaseActionResult) => void;
  onAddImage: () => void;
  anchor?: string;
}) {
  const start = initialVitals(definition);
  const types: ResultType[] = [...RESULT_TYPES_FOR[category]];
  if (!types.includes(result.type)) types.push(result.type);
  const setType = (type: ResultType) => {
    let next: CaseActionResult = { ...result, type };
    if (type !== "lab_table") next = withoutKey(next, "labs");
    else if (!next.labs?.length)
      next.labs = [{ test: "", result: "", reference: "", flag: "normal" }];
    if (type !== "ecg") next = withoutKey(next, "ecg");
    else next.ecg = next.ecg ?? { preset: "sinus_normal" };
    if (type !== "image" && type !== "ecg")
      next = withoutKey(withoutKey(next, "assetId"), "annotation");
    if (type === "ecg") next = withoutKey(next, "assetId");
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {types.length > 1 && (
        <Field label="What kind of response is it?" required group>
          <ChoiceCards
            value={result.type}
            onChange={setType}
            columns={2}
            options={types.map((type) => ({
              value: type,
              label: RESULT_META[type].label,
              description: RESULT_META[type].description,
            }))}
          />
        </Field>
      )}
      <ResponseTextField
        definition={definition}
        category={category}
        value={result.content}
        onChange={(content) => onChange({ ...result, content })}
        {...(result.type === "lab_table"
          ? { label: "Summary the student reads with the table" }
          : {})}
        {...(anchor ? { anchor } : {})}
      />
      {result.type === "lab_table" && (
        <Field
          label="Results table"
          required
          group
          help="One row per test. Flags show students which values are abnormal."
        >
          <LabRowsEditor
            rows={result.labs ?? []}
            onChange={(labs) => onChange({ ...result, labs })}
          />
        </Field>
      )}
      {result.type === "ecg" && (
        <Field
          label="ECG pattern"
          required
          group
          help="The tracing is drawn when the student orders it, at the patient's heart rate at that moment."
        >
          <EcgPicker
            value={result.ecg?.preset}
            heartRate={start?.hr ?? 80}
            onChange={(preset) => onChange({ ...result, ecg: { preset } })}
          />
        </Field>
      )}
      {result.type === "image" && (
        <Field label="Image the student sees" required group>
          <ImagePicker
            definition={definition}
            value={result.assetId}
            onChange={(assetId) => onChange({ ...result, assetId })}
            onAddImage={onAddImage}
          />
        </Field>
      )}
      {(result.type === "image" || result.type === "ecg") && (
        <Field label="Debrief marker" group>
          <MarkerEditor
            definition={definition}
            result={result}
            onChange={(annotation) =>
              onChange(annotation ? { ...result, annotation } : withoutKey(result, "annotation"))
            }
          />
        </Field>
      )}
    </div>
  );
}
