import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, HeartPulse, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActingStudent } from "@/components/study-app";
import {
  CATEGORY_LABELS,
  DIFFICULTY_COLOR,
  SETTING_LABELS,
  STAGE_LABELS,
  fetchCase,
  type CaseRow,
  type Stage,
} from "@/lib/cases";
import { completeAttempt } from "@/lib/cases.functions";
import { NoteButton, SaveItemButton } from "@/components/gamification";

export const Route = createFileRoute("/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Play a clinical case | Medley" },
      {
        name: "description",
        content:
          "Step through a patient case: history, examination, investigations, diagnosis and management.",
      },
      { property: "og:title", content: "Play a clinical case | Medley" },
      {
        property: "og:description",
        content: "Step through a realistic patient case and get a scored debrief.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasePlayer,
});

type Result = Awaited<ReturnType<typeof completeAttempt>>;
const btn =
  "rounded-full px-6 py-3 font-extrabold shadow-md transition-transform active:scale-95 disabled:opacity-50";

function CasePlayer() {
  const { caseId } = Route.useParams();
  const student = useActingStudent();
  const complete = useServerFn(completeAttempt);
  const [c, setC] = useState<CaseRow | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("presentation");
  const [asked, setAsked] = useState<string[]>([]);
  const [exams, setExams] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [inv, setInv] = useState<string[]>([]);
  const [interp, setInterp] = useState("");
  const [dx, setDx] = useState("");
  const [mgmt, setMgmt] = useState<string[]>([]);
  const [comm, setComm] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchCase(caseId)
      .then(setC)
      .catch(() => setErr("Case not found."));
  }, [caseId]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max = 99) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  async function start() {
    if (!student) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("case_attempts")
      .insert({ student_id: student.id, case_id: caseId, mode: "solo" })
      .select("id")
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    setAttemptId(data.id);
    setStage("history");
  }

  async function advance(next: Stage, patch: Record<string, unknown>) {
    if (!attemptId) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("case_attempts")
      .update({ ...patch, current_stage: next })
      .eq("id", attemptId);
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    if (next === "outcome") {
      try {
        setResult(await complete({ data: { attemptId } }));
      } catch (e) {
        setErr((e as Error).message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (err && !c) return <p className="text-muted-foreground">{err}</p>;
  if (!c) return <p className="text-muted-foreground">Loading case…</p>;

  const flow: Stage[] = [
    "presentation",
    "history",
    "exam",
    "differential",
    "investigations",
    "interpretation",
    "diagnosis",
    "management",
    ...(c.communication_task ? ["communication" as Stage] : []),
    "outcome",
    "debrief",
  ];
  const idx = flow.indexOf(stage);
  const afterMgmt: Stage = c.communication_task ? "communication" : "outcome";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All cases
        </Link>
        <div className="flex gap-2">
          <SaveItemButton
            studentId={student?.id}
            contentType="case"
            contentId={caseId}
            title={c.title}
            href={`/cases/${caseId}`}
          />
          <NoteButton studentId={student?.id} contentType="case" contentId={caseId} />
        </div>
      </div>

      <div className="clay-card bg-lavender-soft p-5">
        <div className="flex flex-wrap gap-2 text-xs font-extrabold">
          <span className={`rounded-full px-3 py-1 capitalize ${DIFFICULTY_COLOR[c.difficulty]}`}>
            {c.difficulty}
          </span>
          <span className="rounded-full bg-card px-3 py-1">
            {SETTING_LABELS[c.clinical_setting] ?? c.clinical_setting}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-card px-3 py-1">
            <Clock className="h-3 w-3" />
            {c.estimated_minutes} min
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-black leading-tight">{c.title}</h1>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          {c.patient.name}, {c.patient.age} · {c.patient.sex} · {c.patient.location}
        </p>
        {stage !== "presentation" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-extrabold">
              <span>{STAGE_LABELS[stage]}</span>
              <span>
                {idx + 1}/{flow.length}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-card">
              <div
                className="h-full rounded-full bg-lavender transition-all"
                style={{ width: `${((idx + 1) / flow.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {err && <p className="rounded-2xl bg-pink-soft p-3 text-sm font-bold">{err}</p>}

      {stage === "presentation" && (
        <Panel title="The patient arrives">
          <p className="leading-relaxed">{c.initial_presentation}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {c.specialty} · Year {c.year_level}+ · up to {c.xp_reward} XP
          </p>
          {student ? (
            <button
              disabled={busy}
              onClick={start}
              className={`${btn} mt-5 bg-lavender text-primary-foreground`}
            >
              Start case as {student.name.split(" ")[0]}
            </button>
          ) : (
            <p className="mt-4 text-sm font-bold">Choose a student from the top bar to begin.</p>
          )}
        </Panel>
      )}

      {stage === "history" && (
        <Panel
          title="Take a history"
          hint="Tap questions to ask the patient. Key questions earn reasoning points."
        >
          {c.history_categories.map((cat) => (
            <div key={cat.category} className="mb-4">
              <p className="mb-2 text-xs font-extrabold tracking-widest text-muted-foreground">
                {cat.category.toUpperCase()}
              </p>
              <div className="space-y-2">
                {cat.questions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => !asked.includes(q.id) && setAsked([...asked, q.id])}
                    className={`block w-full rounded-2xl p-3 text-left transition-all ${asked.includes(q.id) ? "bg-lavender-soft" : "bg-muted hover:-translate-y-0.5"}`}
                  >
                    <p className="font-extrabold">{q.q}</p>
                    {asked.includes(q.id) && (
                      <p className="mt-1 text-sm leading-relaxed">“{q.a}”</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Next busy={busy} onClick={() => advance("exam", { history_questions_asked: asked })}>
            Examine the patient
          </Next>
        </Panel>
      )}

      {stage === "exam" && (
        <Panel title="Examination" hint="Choose which examinations to perform.">
          <div className="space-y-2">
            {c.examinations.map((e) => (
              <button
                key={e.id}
                onClick={() => !exams.includes(e.id) && setExams([...exams, e.id])}
                className={`block w-full rounded-2xl p-3 text-left ${exams.includes(e.id) ? "bg-lavender-soft" : "bg-muted"}`}
              >
                <p className="font-extrabold">{e.name}</p>
                {exams.includes(e.id) && (
                  <p className="mt-1 text-sm leading-relaxed">{e.finding}</p>
                )}
              </button>
            ))}
          </div>
          <Next busy={busy} onClick={() => advance("differential", { exams_performed: exams })}>
            Build differentials
          </Next>
        </Panel>
      )}

      {stage === "differential" && (
        <Panel title="Differential diagnosis" hint={`${c.differential_prompt} Pick up to 3.`}>
          <Options
            items={c.diagnosis_options}
            selected={diffs}
            onPick={(v) => toggle(diffs, setDiffs, v, 3)}
          />
          <Next
            busy={busy}
            disabled={!diffs.length}
            onClick={() => advance("investigations", { differential_submission: diffs })}
          >
            Order investigations
          </Next>
        </Panel>
      )}

      {stage === "investigations" && (
        <Panel
          title="Investigations"
          hint="Order only what will change management — unnecessary tests cost points."
        >
          <div className="space-y-2">
            {c.investigations.map((i) => (
              <button
                key={i.id}
                onClick={() => !inv.includes(i.id) && setInv([...inv, i.id])}
                className={`block w-full rounded-2xl p-3 text-left ${inv.includes(i.id) ? "bg-blue-soft" : "bg-muted"}`}
              >
                <p className="font-extrabold">{i.name}</p>
                {inv.includes(i.id) && <p className="mt-1 text-sm leading-relaxed">{i.result}</p>}
              </button>
            ))}
          </div>
          <Next
            busy={busy}
            onClick={() => advance("interpretation", { investigations_ordered: inv })}
          >
            Interpret results
          </Next>
        </Panel>
      )}

      {stage === "interpretation" && (
        <Panel title="Interpret the result" hint={c.interpretation_task.investigation}>
          <p className="mb-3 font-bold leading-relaxed">{c.interpretation_task.prompt}</p>
          <Options items={c.interpretation_task.options} selected={[interp]} onPick={setInterp} />
          <Next
            busy={busy}
            disabled={!interp}
            onClick={() => advance("diagnosis", { interpretation_answer: interp })}
          >
            Make a diagnosis
          </Next>
        </Panel>
      )}

      {stage === "diagnosis" && (
        <Panel title="Final diagnosis" hint="Commit to your most likely diagnosis.">
          <Options items={c.diagnosis_options} selected={[dx]} onPick={setDx} />
          <Next
            busy={busy}
            disabled={!dx}
            onClick={() => advance("management", { final_diagnosis: dx })}
          >
            Plan management
          </Next>
        </Panel>
      )}

      {stage === "management" && (
        <Panel
          title="Management"
          hint="Select every action you would take now. Harmful choices affect patient safety."
        >
          <Options
            items={c.management_options.map((o) => o.label)}
            selected={mgmt.map((id) => c.management_options.find((o) => o.id === id)?.label ?? "")}
            onPick={(l) =>
              toggle(mgmt, setMgmt, c.management_options.find((o) => o.label === l)!.id)
            }
          />
          <Next
            busy={busy}
            disabled={!mgmt.length}
            onClick={() => advance(afterMgmt, { management_choices: mgmt })}
          >
            {c.communication_task ? "Talk to the family" : "See the outcome"}
          </Next>
        </Panel>
      )}

      {stage === "communication" && c.communication_task && (
        <Panel title="Communication" hint={c.communication_task.prompt}>
          <div className="space-y-2">
            {c.communication_task.options.map((o) => (
              <button
                key={o.id}
                onClick={() => setComm(o.id)}
                className={`block w-full rounded-2xl p-3 text-left leading-relaxed ${comm === o.id ? "bg-lavender text-primary-foreground" : "bg-muted"}`}
              >
                {o.text}
              </button>
            ))}
          </div>
          <Next
            busy={busy}
            disabled={!comm}
            onClick={() => advance("outcome", { communication_response: { id: comm } })}
          >
            See the outcome
          </Next>
        </Panel>
      )}

      {stage === "outcome" && result && (
        <Panel title="What happened next">
          <div
            className={`flex items-start gap-3 rounded-2xl p-4 ${result.outcomeKey === "good" ? "bg-mint-soft" : result.outcomeKey === "partial" ? "bg-yellow-soft" : "bg-pink-soft"}`}
          >
            <HeartPulse className="mt-0.5 h-6 w-6 shrink-0" />
            <p className="leading-relaxed">{result.outcome}</p>
          </div>
          <div className="mt-5 text-center">
            <p className="text-sm font-extrabold text-muted-foreground">YOUR SCORE</p>
            <p className="text-6xl font-black">{result.total}</p>
            <p className="text-sm text-muted-foreground">out of 100</p>
          </div>
          <div className="mt-5 space-y-3">
            {Object.entries(result.breakdown).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm font-extrabold">
                  <span>{CATEGORY_LABELS[k] ?? k}</span>
                  <span>
                    {v}/{result.weights[k]}
                  </span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-lavender"
                    style={{ width: `${(v / (result.weights[k] || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStage("debrief")}
            className={`${btn} mt-6 bg-lavender text-primary-foreground`}
          >
            Read the debrief
          </button>
        </Panel>
      )}

      {stage === "debrief" && result && (
        <Panel title="Debrief">
          <p className="leading-relaxed">{result.debrief.summary}</p>
          <div className="mt-4 rounded-2xl bg-mint-soft p-4">
            <p className="font-extrabold">Diagnosis: {result.correctDiagnosis}</p>
            <p className="mt-1 flex items-center gap-1 text-sm">
              {result.yourDiagnosis === result.correctDiagnosis ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> You got it
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" /> You chose {result.yourDiagnosis}
                </>
              )}
            </p>
          </div>
          <h3 className="mt-5 font-black">Recommended management</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {c.management_options
              .filter(
                (o) =>
                  result.correctManagement.includes(o.id) || result.yourManagement.includes(o.id),
              )
              .map((o) => {
                const good = result.correctManagement.includes(o.id),
                  harm = result.harmfulManagement.includes(o.id),
                  mine = result.yourManagement.includes(o.id);
                return (
                  <li
                    key={o.id}
                    className={`rounded-xl p-2 ${harm ? "bg-pink-soft" : good ? "bg-mint-soft" : "bg-muted"}`}
                  >
                    {good ? "✓" : harm ? "✗" : "·"} {o.label}
                    {mine ? " (you)" : good ? " (missed)" : ""}
                  </li>
                );
              })}
          </ul>
          <h3 className="mt-5 font-black">Teaching points</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {result.debrief.teaching_points.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3 className="mt-5 font-black">Common pitfalls</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {result.debrief.pitfalls.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <Link
            to="/cases"
            className={`${btn} mt-6 inline-flex bg-lavender text-primary-foreground`}
          >
            Back to cases
          </Link>
        </Panel>
      )}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clay-card bg-card p-5">
      <h2 className="text-xl font-black">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}
function Options({
  items,
  selected,
  onPick,
}: {
  items: string[];
  selected: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          className={`rounded-full px-4 py-2 text-left text-sm font-bold transition-all active:scale-95 ${selected.includes(i) ? "bg-lavender text-primary-foreground shadow-md" : "bg-lavender-soft"}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
function Next({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={busy || disabled}
      onClick={onClick}
      className={`${btn} mt-5 w-full bg-lavender text-primary-foreground sm:w-auto`}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}
