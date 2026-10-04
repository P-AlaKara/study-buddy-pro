import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Lightbulb, RotateCw, Timer } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useActingStudent } from "@/components/study-app";
import { createSuggestion } from "@/lib/flashcards";
import { Feedback, MarkingSheet, Panel, pinkBtn, softBtn } from "@/components/osce-parts";
import { CATEGORY_LABELS, fetchStations, fmt, scoreChecklist, toResults, type Station } from "@/lib/osce";

export const Route = createFileRoute("/osce/$stationId")({
  validateSearch: z.object({ mode: z.enum(["practice", "peer"]).catch("practice") }),
  head: () => ({ meta: [
    { title: "OSCE station | Medley" },
    { name: "description", content: "Run an OSCE station with a soft timer, hints and a full checklist debrief." },
    { property: "og:title", content: "OSCE station | Medley" },
    { property: "og:description", content: "Practise an OSCE station and get checklist feedback." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: StationPage,
});

type Role = "candidate" | "patient" | "examiner";
const ROLES: Role[] = ["candidate", "patient", "examiner"];

function StationPage() {
  const { stationId } = Route.useParams();
  const { mode } = Route.useSearch();
  const student = useActingStudent();
  const [s, setS] = useState<Station | null>(null);
  const [phase, setPhase] = useState<"run" | "mark" | "feedback">("run");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [hints, setHints] = useState(0);
  const [showPatient, setShowPatient] = useState(false);
  const [role, setRole] = useState<Role>("candidate");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { fetchStations().then(l => setS(l.find(x => x.id === stationId) ?? null)); }, [stationId]);
  useEffect(() => { if (phase !== "run") return; const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, [phase]);
  useEffect(() => {
    if (mode !== "peer" || !student || sessionId) return;
    supabase.from("peer_osce_sessions").insert({ station_id: stationId, candidate_student_id: student.id, patient_student_id: student.id, examiner_student_id: student.id }).select("id").single().then(({ data }) => data && setSessionId(data.id));
  }, [mode, student, stationId, sessionId]);

  if (!s) return <p className="text-muted-foreground">Loading station…</p>;
  const left = s.duration_minutes * 60 - elapsed;
  const score = scoreChecklist(s, done);

  async function finish() {
    if (!s) return;
    setErr("");
    if (student) {
      const { error } = await supabase.from("osce_attempts").insert({ student_id: student.id, station_id: s.id, mode, checklist_results: toResults(s, done), score, time_taken_seconds: elapsed });
      if (error) return setErr(error.message);
      const missed = s.examiner_checklist.filter(i => !done[i.id]).sort((a, b) => Number(!!b.safety) - Number(!!a.safety) || b.marks - a.marks).slice(0, 3);
      for (const m of missed) await createSuggestion(student.id, "osce", s.id, `${s.title}: what should you not forget?`, m.item);
      if (sessionId) await supabase.from("peer_osce_sessions").update({ status: "completed" }).eq("id", sessionId);
    }
    setPhase("feedback"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const header = (
    <div className="clay-card bg-pink-soft p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
        <span className="rounded-full bg-card px-3 py-1">{mode === "peer" ? "Peer OSCE" : "Practice mode"}</span>
        <span className="rounded-full bg-card px-3 py-1">{CATEGORY_LABELS[s.category]}</span>
        {phase === "run" && <span className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1 ${left < 0 ? "bg-yellow-soft" : "bg-card"}`}><Timer className="h-3.5 w-3.5" />{left >= 0 ? fmt(left) : `Over by ${fmt(-left)}`}</span>}
      </div>
      <h1 className="mt-3 text-2xl font-black">{s.title}</h1>
      <p className="text-sm font-bold text-muted-foreground">{s.specialty} · {s.duration_minutes} minutes{mode === "practice" && " · soft timer, take your time"}</p>
    </div>
  );

  if (phase === "feedback") return <Wrap>{header}<Feedback station={s} done={done} score={score} /><div className="flex flex-wrap gap-2"><button className={pinkBtn} onClick={() => { setDone({}); setElapsed(0); setHints(0); setPhase("run"); setSessionId(null); setRole("candidate"); }}>Try again</button><Link to="/osce" className={softBtn}>Station bank</Link></div></Wrap>;

  if (phase === "mark") return <Wrap>{header}<Panel title="Mark the station" className="bg-card"><p className="mb-3 text-sm text-muted-foreground">Tick each item that was done{mode === "peer" ? " (examiner)" : " — be honest with yourself"}.</p><MarkingSheet station={s} done={done} setDone={setDone} />{err && <p className="mt-3 text-sm font-bold text-pink">{err}</p>}<button className={`${pinkBtn} mt-4`} onClick={finish}>See feedback</button></Panel></Wrap>;

  if (mode === "peer") return (
    <Wrap>{header}
      <Panel className="bg-card">
        <p className="mb-2 text-sm font-extrabold">Who is holding the phone?</p>
        <div className="flex flex-wrap gap-2">{ROLES.map(r => <button key={r} onClick={() => setRole(r)} className={`rounded-full px-4 py-2 text-sm font-extrabold capitalize active:scale-95 ${role === r ? "bg-pink text-primary-foreground shadow-md" : "bg-pink-soft"}`}>{r}</button>)}
          <button onClick={() => setRole(ROLES[(ROLES.indexOf(role) + 1) % 3]!)} className="flex items-center gap-1 rounded-full bg-muted px-4 py-2 text-sm font-extrabold active:scale-95"><RotateCw className="h-4 w-4" />Rotate roles</button></div>
        <p className="mt-2 text-xs text-muted-foreground">Each role sees only its own brief. Pass the phone and rotate.</p>
      </Panel>
      {role === "candidate" && <Panel title="Candidate — your task"><p className="leading-relaxed">{s.candidate_instructions}</p></Panel>}
      {role === "patient" && <PatientBrief s={s} />}
      {role === "examiner" && <>
        <Panel title="Examiner — mark scheme"><MarkingSheet station={s} done={done} setDone={setDone} /></Panel>
        <Panel title="Global assessment"><ul className="space-y-1 text-sm">{s.global_assessment_criteria.map(g => <li key={g.domain}><b>{g.domain}:</b> {g.descriptor}</li>)}</ul></Panel>
        <button className={pinkBtn} onClick={finish}>Finish station & show feedback</button>
      </>}
    </Wrap>
  );

  return (
    <Wrap>{header}
      <Panel title="Candidate instructions"><p className="leading-relaxed">{s.candidate_instructions}</p></Panel>
      <Panel className="bg-card">
        <button className={softBtn} onClick={() => setShowPatient(!showPatient)}><Eye className="mr-1 inline h-4 w-4" />{showPatient ? "Hide" : "Show"} patient script</button>
        <p className="mt-2 text-xs text-muted-foreground">Practising alone? Reveal the script to rehearse the patient's answers.</p>
        {showPatient && <div className="mt-3"><PatientBrief s={s} flat /></div>}
      </Panel>
      <Panel title="Hints" className="bg-yellow-soft">
        {s.hints.slice(0, hints).map(h => <p key={h} className="mb-2 flex gap-2 text-sm"><Lightbulb className="h-4 w-4 shrink-0" />{h}</p>)}
        {hints < s.hints.length ? <button className="rounded-full bg-card px-4 py-2 text-sm font-extrabold active:scale-95" onClick={() => setHints(hints + 1)}>Reveal a hint ({s.hints.length - hints} left)</button> : <p className="text-xs">All hints shown.</p>}
      </Panel>
      <Panel title="Resources"><ul className="list-disc pl-5 text-sm">{s.resources.map(r => <li key={r.title}>{r.title} — {r.type}</li>)}</ul></Panel>
      <button className={pinkBtn} onClick={() => setPhase("mark")}>I'm done — mark my station</button>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-4"><Link to="/osce" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Station bank</Link>{children}</div>;
}

function PatientBrief({ s, flat }: { s: Station; flat?: boolean }) {
  const p = s.patient_instructions;
  const body = <div className="space-y-2 text-sm leading-relaxed">
    {p.opening && <p className="rounded-2xl bg-pink-soft p-3 font-bold">Opening line: “{p.opening}”</p>}
    <p><b>Background:</b> {p.background}</p><p><b>Symptoms:</b> {p.symptoms}</p><p><b>History:</b> {p.history}</p><p><b>Emotional state:</b> {p.emotional_state}</p>
    <div><b>Reveal only when asked:</b><ul className="mt-1 list-disc pl-5">{p.reveal_on_ask.map(r => <li key={r}>{r}</li>)}</ul></div>
  </div>;
  return flat ? body : <Panel title="Patient — your script">{body}</Panel>;
}
