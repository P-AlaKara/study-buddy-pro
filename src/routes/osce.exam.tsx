import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Timer } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useActingStudent } from "@/components/study-app";
import { Feedback, MarkingSheet, Panel, pinkBtn, softBtn } from "@/components/osce-parts";
import { CATEGORY_LABELS, DOMAIN_LABELS, band, fetchStations, fmt, scoreChecklist, toResults, type Station } from "@/lib/osce";

export const Route = createFileRoute("/osce/exam")({
  validateSearch: z.object({ ids: z.string().catch(""), type: z.string().catch("custom") }),
  head: () => ({ meta: [
    { title: "OSCE exam circuit | Medley" },
    { name: "description", content: "Sit a strictly timed OSCE circuit and review your competency breakdown." },
    { property: "og:title", content: "OSCE exam circuit | Medley" },
    { property: "og:description", content: "Strictly timed OSCE circuit with results at the end." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ExamCircuit,
});

type StationResult = { station: Station; done: Record<string, boolean>; score: number; time: number };

function ExamCircuit() {
  const { ids, type } = Route.useSearch();
  const student = useActingStudent();
  const [all, setAll] = useState<Station[]>([]);
  const [i, setI] = useState(-1);
  const [phase, setPhase] = useState<"run" | "mark">("run");
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<StationResult[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { fetchStations().then(setAll); }, []);
  const circuit = ids.split(",").map(id => all.find(s => s.id === id)).filter(Boolean) as Station[];
  const s = circuit[i];
  const limit = s ? s.duration_minutes * 60 : 0;

  useEffect(() => {
    if (i < 0 || phase !== "run" || !s) return;
    const t = setInterval(() => setElapsed(e => { if (e + 1 >= limit) { setPhase("mark"); return limit; } return e + 1; }), 1000);
    return () => clearInterval(t);
  }, [i, phase, s, limit]);

  async function next() {
    const r = [...results, { station: s, done, score: scoreChecklist(s, done), time: elapsed }];
    setResults(r); setDone({}); setElapsed(0); setPhase("run"); window.scrollTo({ top: 0 });
    if (student) await supabase.from("osce_attempts").insert({ student_id: student.id, station_id: s.id, mode: "exam", checklist_results: toResults(s, done), score: scoreChecklist(s, done), time_taken_seconds: elapsed });
    if (i + 1 < circuit.length) return setI(i + 1);
    setI(circuit.length);
    if (student) {
      const overall = Math.round(r.reduce((a, x) => a + x.score, 0) / r.length);
      const { data: c } = await supabase.from("osce_circuits").insert({ name: `${type.replace("_", "-")} circuit`, type, station_ids: circuit.map(x => x.id), created_by_student_id: student.id }).select("id").single();
      if (c) await supabase.from("osce_circuit_attempts").insert({ circuit_id: c.id, student_id: student.id, per_station_results: r.map(x => ({ station_id: x.station.id, score: x.score, time: x.time })), overall_result: `${band(overall)} (${overall}%)`, competency_breakdown: breakdown(r) });
    }
  }

  if (!all.length) return <p className="text-muted-foreground">Loading circuit…</p>;
  if (!circuit.length) return <p>No stations selected. <Link to="/osce" className="font-bold text-pink underline">Build a circuit</Link></p>;

  const back = <Link to="/osce" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Station bank</Link>;

  if (i === -1) return <div className="mx-auto max-w-3xl space-y-4">{back}
    <Panel className="bg-pink-soft"><p className="text-xs font-extrabold tracking-widest">EXAM MODE</p><h1 className="mt-1 text-2xl font-black">{circuit.length}-station circuit</h1>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed"><li>The timer is strict — the station ends automatically.</li><li>No hints, no patient script, no feedback until the end.</li><li>After each station, mark the checklist honestly (or hand it to a friend).</li></ul>
      <ol className="mt-3 list-decimal pl-5 text-sm font-bold">{circuit.map((c, k) => <li key={k}>{c.title} · {c.duration_minutes} min</li>)}</ol>
      <button className={`${pinkBtn} mt-4`} onClick={() => setI(0)}>Begin circuit</button></Panel></div>;

  if (i >= circuit.length) {
    const overall = Math.round(results.reduce((a, x) => a + x.score, 0) / results.length);
    const comp = breakdown(results);
    const data = Object.entries(comp).map(([k, v]) => ({ name: DOMAIN_LABELS[k] ?? CATEGORY_LABELS[k] ?? k, value: v }));
    const weak = data.filter(d => d.value < 70).sort((a, b) => a.value - b.value);
    return <div className="mx-auto max-w-3xl space-y-4">{back}
      <Panel className="bg-pink-soft"><p className="text-xs font-extrabold tracking-widest">CIRCUIT RESULT</p><div className="mt-1 flex items-end gap-3"><span className="text-5xl font-black">{overall}%</span><span className="mb-1 rounded-full bg-card px-3 py-1 text-sm font-extrabold">{band(overall)}</span></div></Panel>
      <Panel title="Per-station results"><div className="space-y-2">{results.map((r, k) => <div key={k}>
        <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center gap-3 rounded-2xl bg-muted p-3 text-left"><span className="flex-1 font-extrabold">{k + 1}. {r.station.title}</span><span className="text-xs text-muted-foreground">{fmt(r.time)}</span><span className="font-black">{r.score}%</span></button>
        {open === k && <div className="mt-3"><Feedback station={r.station} done={r.done} score={r.score} /></div>}
      </div>)}</div><p className="mt-2 text-xs text-muted-foreground">Tap a station for its full feedback.</p></Panel>
      <Panel title="Competency breakdown"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 20 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fontWeight: 700 }} /><Bar dataKey="value" fill="var(--pink)" radius={[0, 12, 12, 0]} label={{ position: "right", fontSize: 12, formatter: (v: number) => `${v}%` }} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Suggested areas for improvement" className="bg-yellow-soft">{weak.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{weak.map(w => <li key={w.name}><b>{w.name}</b> ({w.value}%) — revisit the suggested structure and practise this skill in Practice mode.</li>)}</ul> : <p className="text-sm">Every competency is at 70% or higher — try a harder circuit.</p>}</Panel>
      <div className="flex gap-2"><Link to="/osce" className={pinkBtn}>Back to stations</Link></div>
    </div>;
  }

  const left = limit - elapsed;
  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="clay-card sticky top-2 z-10 flex items-center justify-between bg-pink p-4 text-primary-foreground"><span className="font-extrabold">Station {i + 1} of {circuit.length}</span><span className="flex items-center gap-2 text-2xl font-black"><Timer className="h-5 w-5" />{phase === "run" ? fmt(left) : "Time"}</span></div>
    <Panel title={s.title}><p className="text-xs font-extrabold text-muted-foreground">{CATEGORY_LABELS[s.category]}</p><p className="mt-2 leading-relaxed">{s.candidate_instructions}</p>
      {phase === "run" && <button className={`${softBtn} mt-4`} onClick={() => setPhase("mark")}>End station early</button>}</Panel>
    {phase === "mark" && <Panel title="Mark this station"><p className="mb-3 text-sm text-muted-foreground">Tick what was done. Feedback comes at the end of the circuit.</p><MarkingSheet station={s} done={done} setDone={setDone} /><button className={`${pinkBtn} mt-4`} onClick={next}>{i + 1 < circuit.length ? "Next station" : "Finish circuit"}</button></Panel>}
  </div>;
}

function breakdown(r: StationResult[]) {
  const acc: Record<string, [number, number]> = {};
  for (const x of r) for (const it of x.station.examiner_checklist) {
    const a = (acc[it.domain] ??= [0, 0]); a[1] += it.marks; if (x.done[it.id]) a[0] += it.marks;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, [g, t]]) => [k, Math.round((g / t) * 100)]));
}
