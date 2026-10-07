import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Brain, Dna, FlaskConical, HeartPulse, Microscope, Pill, RotateCcw, Shuffle, Sparkles, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { supabase } from "@/integrations/supabase/client";
import { fetchQuestions, MODE_INFO, SUBJECTS, topicAccuracy, type Question, type QuizMode } from "@/lib/quiz";

export const Route = createFileRoute("/quiz/")({
  head: () => ({ meta: [
    { title: "Quizzes | Medley" },
    { name: "description", content: "Practise anatomy, physiology, pathology and pharmacology questions with full explanations." },
    { property: "og:title", content: "Quizzes | Medley" },
    { property: "og:description", content: "Quick, topic, adaptive and timed quizzes with explanations for every option." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: QuizHome,
});

const SUBJECT_ICON: Record<string, typeof Brain> = { Anatomy: HeartPulse, Physiology: Dna, Biochemistry: FlaskConical, Pathology: Microscope, Pharmacology: Pill };
const MODE_ICON: Record<string, typeof Brain> = { quick: Shuffle, topic: Target, adaptive: Sparkles, timed: Timer, mistakes: RotateCcw, bookmarked: Bookmark };

function QuizHome() {
  const student = useActingStudent();
  const nav = useNavigate();
  const [qs, setQs] = useState<Question[]>([]);
  const [acc, setAcc] = useState<Record<string, { right: number; total: number }>>({});
  const [counts, setCounts] = useState({ mistakes: 0, bookmarked: 0 });
  const [subject, setSubject] = useState("");

  useEffect(() => { fetchQuestions().then(setQs); }, []);
  useEffect(() => {
    if (!student || !qs.length) return;
    Promise.all([
      supabase.from("quiz_sessions").select("answers").eq("student_id", student.id).not("completed_at", "is", null),
      supabase.from("bookmarked_questions").select("question_id", { count: "exact", head: true }).eq("student_id", student.id),
    ]).then(([s, b]) => {
      const hist = (s.data ?? []) as unknown as { answers: Record<string, { correct: boolean }> }[];
      setAcc(topicAccuracy(qs, hist));
      const wrong = new Set<string>(); const right = new Set<string>();
      hist.forEach(h => Object.entries(h.answers ?? {}).forEach(([id, r]) => (r.correct ? right : wrong).add(id)));
      setCounts({ mistakes: wrong.size, bookmarked: b.count ?? 0 });
    });
  }, [student, qs]);

  const start = (mode: QuizMode, subj?: string) => nav({ to: "/quiz/play", search: { mode, subject: subj } });

  return (
    <div className="space-y-7">
      <Link to="/practice" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Practice</Link>
      <div>
        <p className="text-xs font-extrabold tracking-widest text-blue">QUIZZES</p>
        <h1 className="mt-1 font-display text-3xl font-black md:text-4xl">Test yourself</h1>
        <p className="mt-2 text-muted-foreground">{qs.length} questions with explanations for every option.</p>
      </div>

      <section>
        <h2 className="font-display text-xl font-black">Pick a mode</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(MODE_INFO) as (keyof typeof MODE_INFO)[]).map(m => {
            const Icon = MODE_ICON[m] ?? Brain;
            const disabled = (m === "mistakes" && !counts.mistakes) || (m === "bookmarked" && !counts.bookmarked);
            const extra = m === "mistakes" ? ` · ${counts.mistakes} to retry` : m === "bookmarked" ? ` · ${counts.bookmarked} saved` : m === "adaptive" && student?.weak_areas.length ? ` · ${student.weak_areas.slice(0, 2).join(", ")}` : "";
            return (
              <button key={m} disabled={disabled} onClick={() => m === "topic" ? document.getElementById("subjects")?.scrollIntoView({ behavior: "smooth" }) : start(m)}
                className="clay-card flex items-start gap-3 bg-blue-soft p-5 text-left disabled:opacity-50">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue"><Icon className="h-5 w-5" /></span>
                <span><span className="block font-display text-lg font-black">{MODE_INFO[m].label}</span><span className="text-sm text-ink-soft">{MODE_INFO[m].desc}{extra}</span></span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="subjects">
        <h2 className="font-display text-xl font-black">Topic practice</h2>
        <p className="text-sm text-muted-foreground">Choose a subject, then start.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SUBJECTS.map(s => {
            const Icon = SUBJECT_ICON[s] ?? Brain; const n = qs.filter(q => q.subject === s).length; const a = acc[s];
            const pct = a ? Math.round((a.right / a.total) * 100) : null;
            return (
              <button key={s} onClick={() => setSubject(s)} disabled={!n} className={`clay-card p-4 text-left disabled:opacity-50 ${subject === s ? "bg-blue" : "bg-card"}`}>
                <Icon className="h-6 w-6" />
                <p className="mt-3 font-display font-black">{s}</p>
                <p className="text-xs text-ink-soft">{n} questions{pct !== null ? ` · ${pct}% correct` : ""}</p>
              </button>
            );
          })}
        </div>
        <Button variant="blue" className="mt-4" disabled={!subject} onClick={() => start("topic", subject)}><Brain /> Start {subject || "topic"} practice</Button>
      </section>
    </div>
  );
}
