import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Ban,
  CircleSlash,
  Clock3,
  GitBranch,
  HeartPulse,
  KeyRound,
  OctagonX,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Siren,
  Star,
} from "lucide-react";
import type { RuntimeVitals } from "@/features/case-challenge/engine";
import type {
  CaseAction,
  CaseActionResult,
  LabRow,
  MedicalCase,
  VitalsDelta,
} from "@/features/case-challenge/schema";
import { cn } from "@/lib/utils";
import {
  VERDICT_META,
  assessAction,
  deltaParts,
  diagnosisLabel,
  formatVital,
  type Verdict,
} from "../case-analysis";
import { CLUE_META, LAB_FLAG_META, VITAL_META } from "../vocabulary";
import { MediaThumb } from "./media";
import { Tag, type Tone } from "./studio-ui";

/* ---- Vitals --------------------------------------------------------------- */

const GRID_SIGNS = [
  { key: "hr", label: "Heart rate", unit: "bpm" },
  { key: "bp", label: "Blood pressure", unit: "mmHg" },
  { key: "rr", label: "Resp. rate", unit: "/min" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "temp", label: "Temp", unit: "°C" },
] as const;

function changeText(now: number, before: number, decimals = 0): ReactNode {
  const diff = Math.round((now - before) * 10 ** decimals) / 10 ** decimals;
  if (!diff) return null;
  const Icon = diff > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-extrabold text-[#4a3799]">
      <Icon aria-hidden className="size-3" />
      <span className="sr-only">{diff > 0 ? "up" : "down"}</span>
      {Math.abs(diff).toFixed(decimals)}
    </span>
  );
}

/** Five observation tiles; with `before`, each shows its change. */
export function VitalsGrid({
  vitals,
  before,
  compact = false,
  className,
}: {
  vitals: RuntimeVitals;
  before?: RuntimeVitals | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-2",
        compact
          ? "grid-cols-[repeat(auto-fit,minmax(5.75rem,1fr))]"
          : "grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]",
        className,
      )}
    >
      {GRID_SIGNS.map(({ key, label, unit }) => {
        const value =
          key === "bp"
            ? `${vitals.systolicBp}/${vitals.diastolicBp}`
            : formatVital(key, vitals[key]);
        let delta: ReactNode = null;
        if (before) {
          delta =
            key === "bp"
              ? changeText(vitals.systolicBp, before.systolicBp)
              : changeText(vitals[key], before[key], key === "temp" ? 1 : 0);
        }
        return (
          <div
            key={key}
            className={cn(
              "rounded-2xl bg-[#f4f1fb] ring-1 ring-[#e6e0f5]",
              compact ? "px-2.5 py-2" : "p-3",
            )}
          >
            <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
              {label}
            </dt>
            <dd className="mt-0.5">
              <span
                className={cn(
                  "font-display font-black tabular-nums",
                  compact ? "text-base" : "text-xl",
                )}
              >
                {value}
              </span>{" "}
              <span className="text-[11px] font-bold text-muted-foreground">{unit}</span>
              {delta && <span className="block">{delta}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function DeltaChips({ delta, empty }: { delta: VitalsDelta | undefined; empty?: string }) {
  const parts = deltaParts(delta);
  if (!parts.length) {
    return empty ? <span className="text-[13px] text-muted-foreground">{empty}</span> : null;
  }
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {parts.map((part) => {
        const Icon = part.value > 0 ? ArrowUp : ArrowDown;
        return (
          <Tag
            key={part.sign}
            tone="accent"
            icon={<Icon aria-hidden className="size-3" />}
            title={VITAL_META[part.sign].label}
          >
            {part.text}
            {part.sign === "spo2" ? "%" : ""}
          </Tag>
        );
      })}
    </span>
  );
}

/* ---- Results ---------------------------------------------------------------- */

const TOKEN_LABELS: Record<string, string> = {
  hr: "heart rate",
  bp: "blood pressure",
  sbp: "systolic BP",
  dbp: "diastolic BP",
  rr: "resp. rate",
  spo2: "SpO₂",
  temp: "temperature",
  rhythm: "rhythm",
};

/** One-line preview with live-value tokens written as words, e.g. "[blood pressure]". */
export function previewText(text: string): string {
  return text
    .replace(/\{(\w+)([+-]\d+)?\}/g, (_match, name: string) => `[${TOKEN_LABELS[name] ?? name}]`)
    .replace(/\s+/g, " ")
    .trim();
}

/** Result text with live-value tokens shown as labelled chips, not raw braces. */
export function ResultText({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) {
    return <p className="text-sm italic text-[#8f2424]">No response written yet.</p>;
  }
  const parts = text.split(/(\{(?:hr|bp|sbp|dbp|rr|spo2|temp|rhythm)(?:[+-]\d+)?\})/g);
  return (
    <p className={cn("whitespace-pre-line text-[15px] leading-relaxed", className)}>
      {parts.map((part, index) => {
        const match = /^\{(\w+)([+-]\d+)?\}$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const name = TOKEN_LABELS[match[1]!] ?? match[1];
        return (
          <span
            key={index}
            title="Filled in with the patient's value at that moment"
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-blue-soft px-1.5 py-0.5 align-baseline text-[13px] font-extrabold text-[#1d4a85]"
          >
            <HeartPulse aria-hidden className="size-3" />
            live {name}
            {match[2] ? ` ${match[2].replace("-", "− ")}` : ""}
          </span>
        );
      })}
    </p>
  );
}

export function LabTable({ rows }: { rows: readonly LabRow[] }) {
  if (!rows.length) return <p className="text-sm italic text-[#8f2424]">No lab rows yet.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-muted text-[12px] font-extrabold uppercase tracking-wider text-ink-soft">
          <tr>
            <th scope="col" className="px-3 py-2">
              Test
            </th>
            <th scope="col" className="px-3 py-2">
              Result
            </th>
            <th scope="col" className="px-3 py-2">
              Reference
            </th>
            <th scope="col" className="px-3 py-2">
              Flag
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row, index) => {
            const flag = row.flag ?? "normal";
            const abnormal = flag !== "normal";
            return (
              <tr key={`${row.test}-${index}`} className={abnormal ? "bg-[#fff8f3]" : ""}>
                <th scope="row" className="px-3 py-2 font-bold">
                  {row.test || "—"}
                </th>
                <td className={cn("px-3 py-2 tabular-nums", abnormal && "font-extrabold")}>
                  <ResultInline text={row.result} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.reference || "—"}</td>
                <td className="px-3 py-2">
                  {abnormal ? (
                    <Tag tone={flag === "critical" ? "bad" : "warn"}>
                      {LAB_FLAG_META[flag].symbol} {LAB_FLAG_META[flag].label}
                    </Tag>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Normal</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultInline({ text }: { text: string }) {
  return /\{\w+([+-]\d+)?\}/.test(text) ? (
    <ResultText text={text} className="inline text-sm" />
  ) : (
    <>{text || "—"}</>
  );
}

/** Everything the student sees after the action: text, table, image or ECG. */
export function ResultView({
  definition,
  result,
  title,
  heartRate,
}: {
  definition: MedicalCase;
  result: CaseActionResult;
  title: string;
  heartRate?: number;
}) {
  const visual = result.type === "image" || result.type === "ecg";
  return (
    <div className={cn("grid gap-3", visual && "md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]")}>
      <div className="min-w-0 space-y-3">
        {result.type === "patient_reply" ? (
          <blockquote className="rounded-2xl rounded-tl-md bg-[#f4f1fb] px-4 py-3 ring-1 ring-[#e6e0f5]">
            <ResultText text={result.content} />
          </blockquote>
        ) : (
          <ResultText text={result.content} />
        )}
        {result.type === "lab_table" && <LabTable rows={result.labs ?? []} />}
      </div>
      {visual && (
        <MediaThumb
          definition={definition}
          result={result}
          title={title}
          {...(heartRate !== undefined ? { heartRate } : {})}
        />
      )}
    </div>
  );
}

export function ActionFacts({ action }: { action: CaseAction }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Tag icon={<Clock3 aria-hidden className="size-3.5" />}>{action.timeCostMin} min</Tag>
      <Tag icon={<BadgeDollarSign aria-hidden className="size-3.5" />}>
        {action.moneyCost > 0 ? `$${action.moneyCost}` : "No cost"}
      </Tag>
    </span>
  );
}

/* ---- Assessment --------------------------------------------------------- */

const VERDICT_STYLE: Record<Verdict, { tone: Tone; icon: ReactNode }> = {
  fatal: { tone: "dark", icon: <OctagonX aria-hidden className="size-3.5" /> },
  harmful: { tone: "bad", icon: <ShieldAlert aria-hidden className="size-3.5" /> },
  context: { tone: "warn", icon: <ShieldQuestion aria-hidden className="size-3.5" /> },
  beneficial: { tone: "good", icon: <ShieldCheck aria-hidden className="size-3.5" /> },
  unnecessary: { tone: "warn", icon: <CircleSlash aria-hidden className="size-3.5" /> },
  neutral: { tone: "neutral", icon: null },
};

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <Tag tone={style.tone} icon={style.icon}>
      {VERDICT_META[verdict].label}
    </Tag>
  );
}

/** Compact flags for a collapsed action row (icon + words, never colour alone). */
export function ActionTags({
  definition,
  action,
  showVerdict = false,
}: {
  definition: MedicalCase;
  action: CaseAction;
  showVerdict?: boolean;
}) {
  const assessment = assessAction(definition, action);
  const tags: ReactNode[] = [];
  if (showVerdict && assessment.verdict !== "neutral") {
    tags.push(<VerdictTag key="verdict" verdict={assessment.verdict} />);
  } else {
    if (action.immediateFailure) tags.push(<VerdictTag key="fatal" verdict="fatal" />);
    else if (action.harmful) tags.push(<VerdictTag key="harmful" verdict="harmful" />);
    if (action.safeWhen) tags.push(<VerdictTag key="context" verdict="context" />);
    if (action.isUnnecessary) tags.push(<VerdictTag key="unnecessary" verdict="unnecessary" />);
  }
  if (assessment.isRequired) {
    tags.push(
      <Tag key="required" tone="good" icon={<Star aria-hidden className="size-3.5" />}>
        Required
      </Tag>,
    );
  }
  if (action.isKeyClue) {
    tags.push(
      <Tag key="key" tone="info" icon={<KeyRound aria-hidden className="size-3.5" />}>
        Key clue
      </Tag>,
    );
  }
  if (action.clueTier === "red_herring") {
    tags.push(
      <Tag key="herring" tone="warn" icon={<Ban aria-hidden className="size-3.5" />}>
        Red herring
      </Tag>,
    );
  }
  if (assessment.preventsRules.length) {
    tags.push(
      <Tag key="prevents" tone="good" icon={<Siren aria-hidden className="size-3.5" />}>
        Time-critical
      </Tag>,
    );
  }
  if (action.variants?.length) {
    tags.push(
      <Tag key="variants" tone="accent" icon={<GitBranch aria-hidden className="size-3.5" />}>
        {action.variants.length} alternative{action.variants.length === 1 ? "" : "s"}
      </Tag>,
    );
  }
  return <span className="inline-flex flex-wrap gap-1.5">{tags}</span>;
}

export function ClueTag({ action }: { action: CaseAction }) {
  return (
    <Tag tone={action.clueTier === "none" ? "neutral" : "accent"}>
      {CLUE_META[action.clueTier].label}
    </Tag>
  );
}

export function DiagnosisList({
  definition,
  ids,
}: {
  definition: MedicalCase;
  ids: readonly string[];
}) {
  if (!ids.length) return <span className="text-[13px] text-muted-foreground">None</span>;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const item = definition.differential.find((entry) => entry.id === id);
        return (
          <Tag
            key={id}
            tone={item?.isCorrect ? "good" : item?.isTempting ? "warn" : "neutral"}
            className="font-bold"
          >
            {diagnosisLabel(definition, id)}
            {item?.isCorrect ? " (correct)" : item?.isTempting ? " (tempting)" : ""}
          </Tag>
        );
      })}
    </span>
  );
}

export const ASSESSMENT_TONE_STYLE: Record<string, string> = {
  good: "bg-mint-soft text-[#0b4f4c]",
  bad: "bg-pink-soft text-[#7b1f1f]",
  warn: "bg-yellow-soft text-[#5c4300]",
  info: "bg-blue-soft text-[#173f72]",
  neutral: "bg-muted text-foreground",
};

export function AssessmentLines({
  definition,
  action,
}: {
  definition: MedicalCase;
  action: CaseAction;
}) {
  const assessment = assessAction(definition, action);
  if (!assessment.lines.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No scoring rule applies: choosing this is neither rewarded nor penalised.
      </p>
    );
  }
  const icons = {
    good: <ShieldCheck aria-hidden className="size-4" />,
    bad: <ShieldAlert aria-hidden className="size-4" />,
    warn: <ShieldQuestion aria-hidden className="size-4" />,
    info: <KeyRound aria-hidden className="size-4" />,
    neutral: null,
  };
  return (
    <ul className="space-y-1.5">
      {assessment.lines.map((line, index) => (
        <li
          key={index}
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-snug",
            ASSESSMENT_TONE_STYLE[line.tone],
          )}
        >
          <span className="mt-0.5 shrink-0">{icons[line.tone]}</span>
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
