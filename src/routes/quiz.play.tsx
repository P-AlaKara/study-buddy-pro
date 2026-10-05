import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  HeartPulse,
  Layers3,
  Lightbulb,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { SuggestionPrompt } from "@/components/suggestion-prompt";
import { supabase } from "@/integrations/supabase/client";
import { createSuggestion } from "@/lib/flashcards";
import {
  adaptivePick,
  fetchQuestions,
  hashSeed,
  isCorrect,
  MODE_INFO,
  shuffle,
  TYPE_LABEL,
  type Answer,
  type Opt,
  type Question,
  type QuizMode,
  type Region,
} from "@/lib/quiz";
import { NoteButton } from "@/components/gamification";

const search = z.object({
  mode: z
    .enum(["quick", "topic", "adaptive", "timed", "mistakes", "bookmarked", "group"])
    .catch("quick"),
  subject: z.string().optional(),
  group: z.string().optional(),
});

export const Route = createFileRoute("/quiz/play")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Quiz session | Medley" },
      { name: "description", content: "Answer questions and learn from detailed explanations." },
      { property: "og:title", content: "Quiz session | Medley" },
      {
        property: "og:description",
        content: "Answer questions and learn from detailed explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Runner,
});

type Rec = { answer: Answer; correct: boolean };
type Sugg = { id: string; front: string; back: string; status: string };

function Runner() {
  const { mode, subject, group } = Route.useSearch();
  const student = useActingStudent();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState<Record<string, Rec>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(0);
  const [sugg, setSugg] = useState<Record<string, Sugg>>({});
  const started = useRef(false);

  useEffect(() => {
    if (!student || started.current) return;
    started.current = true;
    (async () => {
      const all = await fetchQuestions();
      const [{ data: hist }, { data: bms }] = await Promise.all([
        supabase
          .from("quiz_sessions")
          .select("answers")
          .eq("student_id", student.id)
          .not("completed_at", "is", null),
        supabase.from("bookmarked_questions").select("question_id").eq("student_id", student.id),
      ]);
      const history = (hist ?? []) as unknown as {
        answers: Record<string, { correct: boolean }>;
      }[];
      const bm = new Set((bms ?? []).map((b) => b.question_id));
      setBookmarks(bm);
      let picked: Question[];
      if (mode === "topic") picked = shuffle(all.filter((q) => q.subject === subject)).slice(0, 10);
      else if (mode === "adaptive") picked = adaptivePick(all, student.weak_areas, history);
      else if (mode === "mistakes") {
        const last: Record<string, boolean> = {};
        history.forEach((h) =>
          Object.entries(h.answers ?? {}).forEach(([id, r]) => {
            last[id] = r.correct;
          }),
        );
        picked = shuffle(all.filter((q) => last[q.id] === false)).slice(0, 10);
      } else if (mode === "bookmarked") picked = all.filter((q) => bm.has(q.id));
      else if (mode === "group")
        picked = shuffle(all, hashSeed(`${group}-${new Date().toDateString()}`)).slice(0, 10);
      else picked = shuffle(all).slice(0, 10);
      setQuestions(picked);
      if (mode === "timed") setLeft(picked.length * 60);
      const { data } = await supabase
        .from("quiz_sessions")
        .insert({
          student_id: student.id,
          mode,
          group_id: mode === "group" ? (group ?? null) : null,
          question_ids: picked.map((q) => q.id),
        })
        .select("id")
        .single();
      if (data) setSessionId(data.id);
    })();
  }, [student, mode, subject, group]);

  useEffect(() => {
    if (mode !== "timed" || done || !questions) return;
    if (left <= 0 && questions.length) {
      finish(records);
      return undefined;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  });

  const q = questions?.[i];

  async function submit() {
    if (!q || answer === undefined || !student) return;
    const correct = isCorrect(q, answer);
    const next = { ...records, [q.id]: { answer, correct } };
    setRecords(next);
    setRevealed(true);
    if (!correct) {
      const s = await createSuggestion(
        student.id,
        "quiz",
        q.id,
        `${q.topic}: ${q.question_text.length > 110 ? q.question_text.slice(0, 107) + "…" : q.question_text}`,
        `${q.key_concept} ${q.clinical_pearl}`,
      );
      if (s && s.status === "pending") setSugg((p) => ({ ...p, [q.id]: s as Sugg }));
    }
  }
  async function finish(recs: Record<string, Rec>) {
    if (done || !questions) return;
    setDone(true);
    const score = Math.round(
      (Object.values(recs).filter((r) => r.correct).length / Math.max(1, questions.length)) * 100,
    );
    if (sessionId)
      await supabase
        .from("quiz_sessions")
        .update({ answers: recs, score, completed_at: new Date().toISOString() })
        .eq("id", sessionId);
    if (group && student)
      await supabase.from("group_messages").insert({
        group_id: group,
        student_id: student.id,
        message: `Finished today's group quiz with ${score}%`,
      });
  }
  function next() {
    if (!questions) return;
    if (i + 1 >= questions.length) {
      void finish(records);
      return;
    }
    setI(i + 1);
    setAnswer(undefined);
    setRevealed(false);
  }
  async function toggleBookmark() {
    if (!q || !student) return;
    const s = new Set(bookmarks);
    if (s.has(q.id)) {
      s.delete(q.id);
      await supabase
        .from("bookmarked_questions")
        .delete()
        .eq("student_id", student.id)
        .eq("question_id", q.id);
    } else {
      s.add(q.id);
      await supabase
        .from("bookmarked_questions")
        .insert({ student_id: student.id, question_id: q.id });
    }
    setBookmarks(s);
  }

  const back = group ? (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group }}
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Group
    </Link>
  ) : (
    <Link
      to="/quiz"
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Quizzes
    </Link>
  );

  if (!questions)
    return (
      <div className="max-w-3xl space-y-4">
        {back}
        <div className="clay-card h-64 animate-pulse bg-blue-soft" />
      </div>
    );
  if (!questions.length)
    return (
      <div className="max-w-3xl space-y-4">
        {back}
        <div className="clay-card bg-blue-soft p-8 text-center">
          <p className="font-display text-xl font-black">No questions here yet</p>
          <p className="mt-2 text-sm text-ink-soft">Try another mode.</p>
        </div>
      </div>
    );

  if (done) {
    const right = Object.values(records).filter((r) => r.correct).length;
    const pct = Math.round((right / questions.length) * 100);
    return (
      <div className="max-w-3xl space-y-5">
        {back}
        <div className="clay-card bg-blue-soft p-7 text-center">
          <Trophy className="mx-auto h-10 w-10 text-blue" />
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-ink-soft">
            {mode === "group" ? "Group quiz" : MODE_INFO[mode].label} complete
          </p>
          <p className="mt-1 font-display text-5xl font-black">{pct}%</p>
          <p className="mt-1 text-ink-soft">
            {right} of {questions.length} correct
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="blue" onClick={() => window.location.reload()}>
              Try again
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/flashcards">Review suggested cards</Link>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {questions.map((qq) => (
            <div key={qq.id} className="clay-card flex items-start gap-3 bg-card p-4">
              {records[qq.id]?.correct ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-mint" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-pink" />
              )}
              <div>
                <p className="text-sm font-bold">{qq.question_text}</p>
                <p className="mt-1 text-xs text-ink-soft">{qq.key_concept}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!q) return null;
  const rec = records[q.id];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        {back}
        {mode === "timed" && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black ${left < 60 ? "bg-pink-soft" : "bg-blue-soft"}`}
          >
            <Timer className="h-4 w-4" /> {Math.floor(left / 60)}:
            {String(left % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted soft-inset">
        <div
          className="h-full rounded-full bg-blue transition-all"
          style={{ width: `${((i + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <div className="clay-card bg-card p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs font-extrabold">
            <span className="rounded-full bg-blue-soft px-3 py-1">
              Question {i + 1} of {questions.length}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">
              {q.subject} · {q.topic}
            </span>
            <span className="rounded-full bg-muted px-3 py-1">{TYPE_LABEL[q.question_type]}</span>
          </div>
          <button
            onClick={toggleBookmark}
            aria-label={bookmarks.has(q.id) ? "Remove bookmark" : "Bookmark question"}
            className="clay-button flex size-10 shrink-0 items-center justify-center bg-blue-soft"
          >
            {bookmarks.has(q.id) ? (
              <BookmarkCheck className="h-5 w-5 text-blue" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>
        </div>
        <h1 className="mt-4 font-display text-xl font-black leading-snug md:text-2xl">
          {q.question_text}
        </h1>
        {q.media_url && q.question_type !== "image_hotspot" && (
          <img
            src={q.media_url}
            alt="Question image"
            className="mt-4 max-h-64 w-full rounded-2xl bg-muted object-contain p-2"
          />
        )}
        <div className="mt-5">
          <Interaction key={q.id} q={q} answer={answer} setAnswer={setAnswer} revealed={revealed} />
        </div>
        {!revealed ? (
          <Button
            variant="blue"
            size="lg"
            className="mt-6 w-full sm:w-auto"
            disabled={
              answer === undefined ||
              (Array.isArray(answer) && !answer.length && q.question_type === "multi_response")
            }
            onClick={submit}
          >
            Check answer
          </Button>
        ) : (
          <Button variant="blue" size="lg" className="mt-6 w-full sm:w-auto" onClick={next}>
            {i + 1 >= questions.length ? "See results" : "Next question"} <ArrowRight />
          </Button>
        )}
      </div>

      {revealed && rec && <Explanation q={q} correct={rec.correct} studentId={student?.id} />}
      {revealed && sugg[q.id] && student && (
        <SuggestionPrompt studentId={student.id} s={sugg[q.id]!} compact />
      )}
    </div>
  );
}

function Interaction({
  q,
  answer,
  setAnswer,
  revealed,
}: {
  q: Question;
  answer: Answer | undefined;
  setAnswer: (a: Answer) => void;
  revealed: boolean;
}) {
  const t = q.question_type;
  const order = useMemo(
    () => (t === "sequencing" ? shuffle((q.options as Opt[]).map((o) => o.id)) : []),
    [q, t],
  );
  const rightOpts = useMemo(
    () => (t === "matching" ? shuffle((q.options as { right: Opt[] }).right) : []),
    [q, t],
  );
  useEffect(() => {
    if (t === "sequencing") setAnswer(order);
    if (t === "multi_response") setAnswer([]);
    if (t === "matching") setAnswer({});
  }, [t, order]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = (id: string, selected: boolean) => {
    if (!revealed)
      return selected ? "bg-blue ring-2 ring-blue" : "bg-blue-soft hover:-translate-y-0.5";
    const c = q.correct_answer;
    const ok = Array.isArray(c) ? c.includes(id) : c === id;
    return ok
      ? "bg-mint-soft ring-2 ring-mint"
      : selected
        ? "bg-pink-soft ring-2 ring-pink"
        : "bg-muted opacity-70";
  };

  if (t === "matching") {
    const o = q.options as { left: Opt[]; right: Opt[] };
    const a = (answer ?? {}) as Record<string, string>;
    const c = q.correct_answer as Record<string, string>;
    return (
      <div className="space-y-3">
        {o.left.map((l) => (
          <div
            key={l.id}
            className={`flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center ${revealed ? (a[l.id] === c[l.id] ? "bg-mint-soft" : "bg-pink-soft") : "bg-blue-soft"}`}
          >
            <span className="font-bold sm:w-1/3">{l.text}</span>
            <select
              disabled={revealed}
              value={a[l.id] ?? ""}
              onChange={(e) => setAnswer({ ...a, [l.id]: e.target.value })}
              className="flex-1 rounded-full bg-card px-4 py-2 text-sm font-bold soft-inset"
            >
              <option value="">Choose a match…</option>
              {rightOpts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
            {revealed && a[l.id] !== c[l.id] && (
              <span className="text-xs font-bold">
                → {o.right.find((r) => r.id === c[l.id])?.text}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (t === "sequencing") {
    const opts = q.options as Opt[];
    const a = (answer ?? order) as string[];
    const c = q.correct_answer as string[];
    const move = (idx: number, d: number) => {
      const n = [...a];
      [n[idx], n[idx + d]] = [n[idx + d]!, n[idx]!];
      setAnswer(n as string[]);
    };
    return (
      <ol className="space-y-2">
        {a.map((id, idx) => (
          <li
            key={id}
            className={`flex items-center gap-3 rounded-2xl p-3 ${revealed ? (c[idx] === id ? "bg-mint-soft" : "bg-pink-soft") : "bg-blue-soft"}`}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-card text-sm font-black">
              {idx + 1}
            </span>
            <span className="flex-1 font-bold">{opts.find((o) => o.id === id)?.text}</span>
            {!revealed && (
              <span className="flex gap-1">
                <button
                  aria-label="Move up"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  className="clay-button bg-card p-2 disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  aria-label="Move down"
                  disabled={idx === a.length - 1}
                  onClick={() => move(idx, 1)}
                  className="clay-button bg-card p-2 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </span>
            )}
          </li>
        ))}
        {revealed && (
          <p className="text-sm font-bold text-ink-soft">
            Correct order: {c.map((id) => opts.find((o) => o.id === id)?.text).join(" → ")}
          </p>
        )}
      </ol>
    );
  }
  if (t === "image_hotspot") {
    const regions = (q.options as { regions: Region[] }).regions;
    return (
      <div className="relative mx-auto aspect-square w-full max-w-sm rounded-[28px] bg-pink-soft p-2">
        <HeartPulse className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 text-pink/40" />
        <div className="absolute left-1/2 top-[6%] h-[88%] w-1 -translate-x-1/2 rounded bg-card" />
        <div className="absolute left-[6%] top-1/2 h-1 w-[88%] -translate-y-1/2 rounded bg-card" />
        {regions.map((r) => (
          <button
            key={r.id}
            disabled={revealed}
            onClick={() => setAnswer(r.id)}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
            className={`absolute rounded-3xl text-xs font-black transition-all ${cls(r.id, answer === r.id)} ${!revealed && answer !== r.id ? "bg-card/40" : ""}`}
          >
            {revealed ? r.label : answer === r.id ? "Selected" : ""}
          </button>
        ))}
        <p className="absolute -bottom-7 left-0 right-0 text-center text-xs text-muted-foreground">
          Schematic: top = atria, bottom = ventricles, patient's right on your left.
        </p>
      </div>
    );
  }
  const opts = q.options as Opt[];
  const multi = t === "multi_response";
  const sel = (answer ?? (multi ? [] : "")) as string | string[];
  return (
    <div className="grid gap-2">
      {opts.map((o) => {
        const selected = multi ? (sel as string[]).includes(o.id) : sel === o.id;
        return (
          <button
            key={o.id}
            disabled={revealed}
            onClick={() =>
              setAnswer(
                multi
                  ? selected
                    ? (sel as string[]).filter((x) => x !== o.id)
                    : [...(sel as string[]), o.id]
                  : o.id,
              )
            }
            className={`flex items-center gap-3 rounded-2xl p-4 text-left font-bold transition-all ${cls(o.id, selected)}`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center ${multi ? "rounded-lg" : "rounded-full"} bg-card text-xs font-black uppercase`}
            >
              {o.id}
            </span>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

function Explanation({
  q,
  correct,
  studentId,
}: {
  q: Question;
  correct: boolean;
  studentId?: string;
}) {
  const labels: Record<string, string> = {};
  const o = q.options as Opt[] | { left: Opt[] } | { regions: Region[] };
  if (Array.isArray(o))
    o.forEach((x) => {
      labels[x.id] = x.text;
    });
  else if ("left" in o)
    o.left.forEach((x) => {
      labels[x.id] = x.text;
    });
  else
    o.regions.forEach((x) => {
      labels[x.id] = x.label;
    });
  return (
    <div className="clay-card space-y-4 bg-blue-soft p-5 md:p-7">
      <p
        className={`flex items-center gap-2 font-display text-lg font-black ${correct ? "text-foreground" : ""}`}
      >
        {correct ? (
          <CheckCircle2 className="h-6 w-6 text-mint" />
        ) : (
          <XCircle className="h-6 w-6 text-pink" />
        )}
        {correct ? "Correct!" : "Not quite"}
      </p>
      <div className="space-y-2">
        {Object.entries(q.option_explanations).map(([id, text]) => (
          <div key={id} className="rounded-2xl bg-card/80 p-3 text-sm leading-relaxed">
            <span className="font-black">{labels[id] ?? id}: </span>
            {text}
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-xs font-black uppercase tracking-wider text-blue">Key concept</p>
          <p className="mt-1 text-sm leading-relaxed">{q.key_concept}</p>
        </div>
        <div className="rounded-2xl bg-yellow-soft p-4">
          <p className="flex items-center gap-1 text-xs font-black uppercase tracking-wider">
            <Lightbulb className="h-4 w-4" /> Clinical pearl
          </p>
          <p className="mt-1 text-sm leading-relaxed">{q.clinical_pearl}</p>
        </div>
      </div>
      {q.references.length > 0 && (
        <p className="text-xs text-ink-soft">
          <span className="font-black">References: </span>
          {q.references.join(" · ")}
        </p>
      )}
      <NoteButton studentId={studentId} contentType="quiz_question" contentId={q.id} />
      {(q.related_case_id || q.related_flashcard_deck_id) && (
        <div className="flex flex-wrap gap-2">
          {q.related_case_id && (
            <Button size="sm" variant="lavender" asChild>
              <Link to="/cases/$caseId" params={{ caseId: q.related_case_id }}>
                <HeartPulse /> Related case
              </Link>
            </Button>
          )}
          {q.related_flashcard_deck_id && (
            <Button size="sm" variant="yellow" asChild>
              <Link to="/flashcards/$deckId" params={{ deckId: q.related_flashcard_deck_id }}>
                <Layers3 /> Related deck
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
