import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { DOMAIN_LABELS, band, type Station } from "@/lib/osce";

export const pinkBtn = "rounded-full bg-pink px-6 py-3 font-extrabold text-foreground shadow-md transition-transform active:scale-95 disabled:opacity-50";
export const softBtn = "rounded-full bg-pink-soft px-5 py-2.5 font-extrabold transition-transform active:scale-95";

export function Panel({ title, children, className = "bg-card" }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`clay-card p-5 ${className}`}>{title && <h2 className="mb-3 text-lg font-black">{title}</h2>}{children}</section>;
}

export function MarkingSheet({ station, done, setDone }: { station: Station; done: Record<string, boolean>; setDone: (d: Record<string, boolean>) => void }) {
  return <div className="space-y-2">{station.examiner_checklist.map(i => (
    <button key={i.id} onClick={() => setDone({ ...done, [i.id]: !done[i.id] })} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all ${done[i.id] ? "bg-mint-soft" : "bg-muted"}`}>
      {done[i.id] ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" /> : <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-card" />}
      <span className="flex-1 text-sm font-bold leading-relaxed">{i.item}{i.safety && <span className="ml-2 rounded-full bg-pink-soft px-2 py-0.5 text-xs">safety</span>}</span>
      <span className="text-xs font-extrabold text-muted-foreground">{i.marks} mk</span>
    </button>
  ))}</div>;
}

export function Feedback({ station, done, score }: { station: Station; done: Record<string, boolean>; score: number }) {
  const items = station.examiner_checklist;
  const well = items.filter(i => done[i.id]);
  const missed = items.filter(i => !done[i.id]);
  const safety = missed.filter(i => i.safety || i.domain === "safety");
  const comm = items.filter(i => i.domain === "communication");
  const commDone = comm.filter(i => done[i.id]).length;
  return (
    <div className="space-y-4">
      <Panel className="bg-pink-soft">
        <p className="text-xs font-extrabold tracking-widest">STATION RESULT</p>
        <div className="mt-1 flex items-end gap-3"><span className="text-5xl font-black">{score}%</span><span className="mb-1 rounded-full bg-card px-3 py-1 text-sm font-extrabold">{band(score)}</span></div>
      </Panel>
      <Panel title="Examiner checklist">
        <ul className="space-y-1.5">{items.map(i => <li key={i.id} className="flex items-start gap-2 text-sm">
          {done[i.id] ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-pink" />}
          <span className="flex-1">{i.item}</span><span className="text-xs font-bold text-muted-foreground">{done[i.id] ? i.marks : 0}/{i.marks}</span>
        </li>)}</ul>
      </Panel>
      <List title="What was done well" items={well.map(i => i.item)} empty="Nothing marked yet — keep practising the basics." tone="bg-mint-soft" />
      <List title="Important omissions" items={missed.map(i => `${i.item} (${DOMAIN_LABELS[i.domain] ?? i.domain})`)} empty="No omissions — excellent." tone="bg-yellow-soft" />
      <List title="Patient-safety issues" items={safety.map(i => i.item)} empty="No patient-safety steps were missed." tone="bg-pink-soft" />
      <Panel title="Communication feedback">
        <p className="text-sm leading-relaxed">You covered {commDone} of {comm.length} communication points. {commDone === comm.length ? "Your consultation skills were complete — keep that warmth and structure." : commDone >= comm.length / 2 ? "Solid rapport; tighten the missing steps such as summarising and checking understanding." : "Focus on introductions, empathy and checking understanding — examiners weigh these heavily."}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{station.global_assessment_criteria.map(g => <li key={g.domain}><b>{g.domain}:</b> {g.descriptor}</li>)}</ul>
      </Panel>
      <List title="Suggested structure" items={station.suggested_structure} ordered tone="bg-card" />
      <List title="Key learning points" items={station.learning_points} tone="bg-card" />
      <List title="Resources for improvement" items={station.resources.map(r => `${r.title} — ${r.type}`)} tone="bg-card" />
    </div>
  );
}

function List({ title, items, empty, tone, ordered }: { title: string; items: string[]; empty?: string; tone: string; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return <Panel title={title} className={tone}>{items.length ? <Tag className={`space-y-1 pl-5 text-sm leading-relaxed ${ordered ? "list-decimal" : "list-disc"}`}>{items.map(i => <li key={i}>{i}</li>)}</Tag> : <p className="text-sm">{empty}</p>}</Panel>;
}
