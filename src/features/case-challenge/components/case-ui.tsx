import { Activity, Clock3, BadgeDollarSign, Check, UserRound } from "lucide-react";
import type { CaseAction, MedicalCase } from "../schema.js";
import { CaseImageViewer } from "./case-image-viewer.js";
import { categoryMeta } from "./case-constants.js";

export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`} aria-label="Typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="case-typing-dot size-2 rounded-full bg-[var(--case-accent)]"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** The patient reply / clinical finding that follows a completed action. */
export function ActionResultEntry({
  action,
  caseDefinition,
}: {
  action: CaseAction;
  caseDefinition: MedicalCase;
}) {
  const asset = action.result.assetId
    ? caseDefinition.assets.find((candidate) => candidate.id === action.result.assetId)
    : undefined;
  const isPatientReply = action.result.type === "patient_reply";
  const title = isPatientReply
    ? `Patient · ${caseDefinition.patient.name}`
    : action.category === "examine"
      ? "Examination findings"
      : action.category === "test"
        ? "Investigation result"
        : action.category === "treat"
          ? "Treatment response"
          : "Clinical finding";

  return (
    <article
      className={`mr-auto max-w-[96%] rounded-[18px] rounded-bl-md border p-4 sm:max-w-[88%] ${
        isPatientReply
          ? "border-[color-mix(in_srgb,var(--case-blue)_35%,white)] bg-[var(--case-blue-soft)]"
          : "border-[var(--case-border)] bg-white shadow-[0_8px_22px_-20px_rgb(37_48_68/35%)]"
      }`}
    >
      <div className="flex gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full ${
            isPatientReply ? "bg-white text-[var(--case-blue-ink)]" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isPatientReply ? <UserRound className="size-4" /> : <Activity className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-800">
            {isPatientReply ? `“${action.result.content}”` : action.result.content}
          </p>
        </div>
      </div>

      {action.result.type === "lab_table" && action.result.labs && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {action.result.labs.map((lab) => (
                <tr key={lab.test} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold">{lab.test}</td>
                  <td
                    className={`px-3 py-2 font-mono font-black ${
                      lab.flag && lab.flag !== "normal"
                        ? "text-[var(--case-critical)]"
                        : "text-slate-700"
                    }`}
                  >
                    {lab.result}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{lab.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {asset && (action.result.type === "image" || action.result.type === "ecg") && (
        <div className="mt-3 overflow-hidden rounded-xl">
          <CaseImageViewer
            asset={asset}
            assetPath={`/cases/${caseDefinition.slug}/${asset.filename}`}
            result={action.result}
          />
        </div>
      )}
    </article>
  );
}

/** A single selectable clinical action (question, exam, test or treatment). */
export function ActionCard({
  action,
  used,
  busy,
  disabled,
  onChoose,
}: {
  action: CaseAction;
  used: boolean;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const meta = categoryMeta[action.category];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      disabled={used || busy || disabled}
      onClick={onChoose}
      style={used ? undefined : { backgroundColor: meta.soft }}
      className={`group relative rounded-[18px] p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] ${
        used
          ? "bg-slate-100 text-slate-400"
          : "text-slate-800 hover:-translate-y-0.5 hover:shadow-md"
      } disabled:cursor-not-allowed`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"
          style={{ color: used ? undefined : meta.ink }}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-snug">{action.label}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-extrabold text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
              <Clock3 className="size-3" /> {action.timeCostMin}m
            </span>
            {action.moneyCost > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
                <BadgeDollarSign className="size-3" /> {action.moneyCost}
              </span>
            )}
          </div>
          {!used && action.riskNote && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-slate-500">
              {action.riskNote}
            </p>
          )}
        </div>
        {used && <Check className="size-4 shrink-0" />}
      </div>
    </button>
  );
}

export function ScoreMeter({ score, maximum }: { score: number; maximum: number }) {
  const percent = Math.round((score / maximum) * 100);
  return (
    <div
      className="w-28 rounded-full border border-[var(--case-border)] bg-white px-3 py-2 shadow-sm"
      aria-label={`Efficiency score ${score} of ${maximum}`}
    >
      <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-500">
        <span>Efficiency</span>
        <span>{score}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--case-accent)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
