import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Search, Timer, Users } from "lucide-react";
import { CATEGORY_LABELS, fetchStations, type Station } from "@/lib/osce";
import { pinkBtn } from "@/components/osce-parts";

export const Route = createFileRoute("/osce/")({
  head: () => ({ meta: [
    { title: "OSCE station bank | Medley" },
    { name: "description", content: "Practise OSCE stations in practice, timed exam and peer modes, with checklist feedback." },
    { property: "og:title", content: "OSCE station bank | Medley" },
    { property: "og:description", content: "Practise OSCE stations in practice, exam and peer modes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: StationBank,
});

const DIFF: Record<string, string> = { easy: "bg-mint-soft", medium: "bg-yellow-soft", hard: "bg-pink-soft" };
const TYPES = [{ id: "single", label: "Single", n: 1 }, { id: "5_station", label: "5-station", n: 5 }, { id: "10_station", label: "10-station", n: 10 }, { id: "custom", label: "Custom", n: 0 }];

function StationBank() {
  const nav = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ specialty: "", year: "", category: "", difficulty: "", duration: "" });
  const [builder, setBuilder] = useState(false);
  const [type, setType] = useState("custom");
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { fetchStations().then(setStations); }, []);

  const opts = (k: keyof Station) => [...new Set(stations.map(s => String(s[k])))];
  const shown = stations.filter(s =>
    (!q || `${s.title} ${s.topic} ${s.specialty}`.toLowerCase().includes(q.toLowerCase())) &&
    (!f.specialty || s.specialty === f.specialty) && (!f.year || String(s.year) === f.year) && (!f.category || s.category === f.category) &&
    (!f.difficulty || s.difficulty === f.difficulty) && (!f.duration || (f.duration === "short" ? s.duration_minutes <= 8 : s.duration_minutes > 8)));
  const grouped = useMemo(() => shown.reduce<Record<string, Station[]>>((a, s) => ((a[s.category] ??= []).push(s), a), {}), [shown]);

  function chooseType(t: string) {
    setType(t);
    const n = TYPES.find(x => x.id === t)!.n;
    if (n) setPicked(Array.from({ length: n }, (_, i) => stations[i % stations.length]?.id).filter((x): x is string => !!x));
  }
  const toggle = (id: string) => type === "single" ? setPicked([id]) : setPicked(picked.includes(id) && type === "custom" ? picked.filter(x => x !== id) : [...picked, id]);

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/practice" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Practice</Link>
      <div>
        <p className="text-xs font-extrabold tracking-widest text-pink">OSCE PREP</p>
        <h1 className="mt-1 text-3xl font-black">Station bank</h1>
        <p className="mt-2 text-muted-foreground">Practise with hints, sit a strict timed circuit, or run a station with friends.</p>
      </div>

      <div className="clay-card bg-pink-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-black"><Timer className="h-5 w-5" /> Exam mode circuit</h2><p className="text-sm">Strict timer, no hints, results at the end.</p></div>
          <button className={pinkBtn} onClick={() => setBuilder(!builder)}>{builder ? "Close builder" : "Build a circuit"}</button>
        </div>
        {builder && <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">{TYPES.map(t => <Chip key={t.id} active={type === t.id} onClick={() => chooseType(t.id)}>{t.label}</Chip>)}</div>
          <p className="text-sm">{type === "custom" ? "Tap stations below to add them (tap again to remove)." : type === "single" ? "Tap one station below." : `Auto-filled with ${picked.length} stations — stations repeat until the bank grows. Tap to add more.`}</p>
          <div className="flex flex-wrap gap-2">{picked.map((id, i) => <span key={i} className="rounded-full bg-card px-3 py-1 text-xs font-bold">{i + 1}. {stations.find(s => s.id === id)?.title}</span>)}</div>
          <button disabled={!picked.length} className={pinkBtn} onClick={() => nav({ to: "/osce/exam", search: { ids: picked.join(","), type } })}>Start circuit ({picked.length})</button>
        </div>}
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-full bg-card px-4 py-3 shadow-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search stations, topics…" className="flex-1 bg-transparent outline-none" /></label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Select value={f.category} onChange={v => setF({ ...f, category: v })} label="Skill" options={opts("category").map(c => [c, CATEGORY_LABELS[c] ?? c])} />
          <Select value={f.specialty} onChange={v => setF({ ...f, specialty: v })} label="Specialty" options={opts("specialty").map(c => [c, c])} />
          <Select value={f.year} onChange={v => setF({ ...f, year: v })} label="Year" options={opts("year").map(c => [c, `Year ${c}`])} />
          <Select value={f.difficulty} onChange={v => setF({ ...f, difficulty: v })} label="Difficulty" options={[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]]} />
          <Select value={f.duration} onChange={v => setF({ ...f, duration: v })} label="Duration" options={[["short", "≤ 8 min"], ["long", "> 8 min"]]} />
        </div>
      </div>

      {Object.entries(grouped).map(([cat, list]) => <div key={cat}>
        <h2 className="mb-3 text-sm font-extrabold tracking-widest text-muted-foreground">{(CATEGORY_LABELS[cat] ?? cat).toUpperCase()}</h2>
        <div className="grid gap-4 sm:grid-cols-2">{list.map(s => (
          <div key={s.id} className={`clay-card p-5 transition-transform hover:-translate-y-1 ${builder && picked.includes(s.id) ? "bg-pink-soft" : "bg-card"}`}>
            <div className="flex flex-wrap gap-2 text-xs font-extrabold">
              <span className={`rounded-full px-3 py-1 capitalize ${DIFF[s.difficulty]}`}>{s.difficulty}</span>
              <span className="rounded-full bg-muted px-3 py-1">Year {s.year}</span>
              <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Clock className="h-3 w-3" />{s.duration_minutes} min</span>
            </div>
            <h3 className="mt-3 text-lg font-black">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.specialty} · {s.topic}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {builder ? <button className={pinkBtn} onClick={() => toggle(s.id)}>{picked.includes(s.id) ? "Added ✓" : "Add to circuit"}</button> : <>
                <Link to="/osce/$stationId" params={{ stationId: s.id }} search={{ mode: "practice" }} className="rounded-full bg-pink px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-md active:scale-95">Practice</Link>
                <Link to="/osce/exam" search={{ ids: s.id, type: "single" }} className="rounded-full bg-pink-soft px-5 py-2.5 text-sm font-extrabold active:scale-95">Exam</Link>
                <Link to="/osce/$stationId" params={{ stationId: s.id }} search={{ mode: "peer" }} className="flex items-center gap-1 rounded-full bg-pink-soft px-5 py-2.5 text-sm font-extrabold active:scale-95"><Users className="h-4 w-4" />Peer</Link>
              </>}
            </div>
          </div>
        ))}</div>
      </div>)}
      {stations.length > 0 && !shown.length && <p className="text-muted-foreground">No stations match these filters.</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-extrabold active:scale-95 ${active ? "bg-pink text-primary-foreground shadow-md" : "bg-card"}`}>{children}</button>;
}
function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[][] }) {
  return <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold outline-none ${value ? "bg-pink text-primary-foreground" : "bg-pink-soft"}`}>
    <option value="">{label}: all</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>;
}
