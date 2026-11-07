// Exam-taking interface (wireframes 5–7). One question at a time, a question
// navigator, autosave, flagging, flashcard saving, and submit. Correct answers
// are never sent to the client here — exam mode reveals them only after submit.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  Flag,
  Layers3,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProblem } from "@/lib/log-problem";
import { Bar, Chip } from "./ui";
import {
  addExamQuestionToDeck,
  listExamDecks,
  saveAnswer,
  setAttemptPosition,
  startOrResumeAttempt,
  submitAttempt,
  toggleFlag,
  type ExamDeck,
} from "./exam-generator.functions";
import type { AttemptPayload, TakingQuestion } from "./types";

interface LocalAnswer {
  selectedOption: string | null;
  responseText: string | null;
  flagged: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "MCQ",
  short: "Short answer",
  long: "Long answer",
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ExamPlayer({ examId, onSubmitted }: { examId: string; onSubmitted: () => void }) {
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    startOrResumeAttempt({ data: { examId } })
      .then((data) => {
        if (!active) return;
        if (data.status === "submitted") {
          onSubmitted();
          return;
        }
        setPayload(data);
        setIndex(Math.min(data.currentIndex, Math.max(0, data.questions.length - 1)));
        const map: Record<string, LocalAnswer> = {};
        for (const a of data.answers) {
          map[a.questionId] = {
            selectedOption: a.selectedOption,
            responseText: a.responseText,
            flagged: a.flagged,
          };
        }
        setAnswers(map);
        setSaved(new Set(data.savedQuestionIds));
      })
      .catch((err) => {
        logProblem("Start/resume attempt", err);
        if (active)
          setLoadError(err instanceof Error ? err.message : "This exam could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [examId, onSubmitted]);

  // Elapsed session timer (cosmetic; self-paced, no limit).
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const questions = payload?.questions ?? [];
  const current = questions[index];

  const persist = useCallback(
    async (
      questionId: string,
      patch: { selectedOption?: string | null; responseText?: string | null },
      newIndex: number,
    ) => {
      setSaveState("saving");
      try {
        await saveAnswer({ data: { examId, questionId, ...patch, index: newIndex } });
        setSaveState("saved");
      } catch (err) {
        logProblem("Save answer", err);
        setSaveState("idle");
      }
    },
    [examId],
  );

  const chooseOption = (optionId: string) => {
    if (!current) return;
    setAnswers((cur) => ({
      ...cur,
      [current.id]: { ...answer(cur, current.id), selectedOption: optionId },
    }));
    void persist(current.id, { selectedOption: optionId }, index);
  };

  const changeText = (value: string) => {
    if (!current) return;
    setAnswers((cur) => ({
      ...cur,
      [current.id]: { ...answer(cur, current.id), responseText: value },
    }));
    setSaveState("saving");
    if (textTimer.current) window.clearTimeout(textTimer.current);
    textTimer.current = window.setTimeout(
      () => void persist(current.id, { responseText: value }, index),
      800,
    );
  };

  const flag = async () => {
    if (!current) return;
    const next = !answer(answers, current.id).flagged;
    setAnswers((cur) => ({ ...cur, [current.id]: { ...answer(cur, current.id), flagged: next } }));
    try {
      await toggleFlag({ data: { examId, questionId: current.id, flagged: next } });
    } catch (err) {
      logProblem("Toggle flag", err);
    }
  };

  const goto = (next: number) => {
    const clamped = Math.max(0, Math.min(questions.length - 1, next));
    setIndex(clamped);
    setSaveState("idle");
    void setAttemptPosition({ data: { examId, index: clamped } }).catch(() => undefined);
  };

  const submit = async () => {
    if (
      !window.confirm("Submit this exam? You’ll see your results and can then review every answer.")
    )
      return;
    setSubmitting(true);
    try {
      if (textTimer.current) window.clearTimeout(textTimer.current);
      await submitAttempt({ data: { examId } });
      onSubmitted();
    } catch (err) {
      logProblem("Submit attempt", err);
      setSubmitting(false);
      window.alert(err instanceof Error ? err.message : "The exam could not be submitted.");
    }
  };

  if (loadError) {
    return (
      <div className="clay-card bg-pink-soft p-6 text-sm font-semibold text-[color:var(--case-pink-ink)]">
        {loadError}
      </div>
    );
  }
  if (!payload || !current) {
    return (
      <div className="grid min-h-60 place-items-center">
        <Loader2 className="size-7 animate-spin text-blue" />
      </div>
    );
  }

  const a = answer(answers, current.id);
  const answeredCount = questions.filter((q) => {
    const ans = answers[q.id];
    return ans && (ans.selectedOption || (ans.responseText && ans.responseText.trim()));
  }).length;
  const progressPercent = (answeredCount / questions.length) * 100;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Chip tone="blue">
            {current.topic.toUpperCase()} · {TYPE_LABEL[current.type]}
          </Chip>
          <h2 className="mt-2 font-display text-2xl font-black">
            Question {index + 1}{" "}
            <span className="text-base text-muted-foreground">/ {questions.length}</span>
          </h2>
        </div>
        <Chip tone="lavender">⏱ {formatElapsed(elapsed)}</Chip>
      </div>
      <Bar percent={progressPercent} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
        {/* Question body */}
        <div className="clay-card bg-card p-5 md:p-6">
          <h3 className="whitespace-pre-line font-display text-lg font-black leading-relaxed">
            {current.questionText}
          </h3>

          {current.type === "mcq" && current.options && (
            <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Answer options">
              {current.options.map((opt) => {
                const selected = a.selectedOption === opt.id;
                return (
                  <button
                    key={opt.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseOption(opt.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left text-sm transition-colors ${
                      selected ? "bg-blue-soft ring-2 ring-blue" : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${
                        selected
                          ? "border-blue bg-blue text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {opt.id}
                    </span>
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {current.type === "short" && (
            <input
              value={a.responseText ?? ""}
              onChange={(e) => changeText(e.target.value)}
              placeholder="Type your answer…"
              className="mt-4 w-full rounded-2xl border border-border bg-background p-3.5 text-sm soft-inset focus:outline-none focus:ring-2 focus:ring-blue"
            />
          )}

          {current.type === "long" && (
            <textarea
              value={a.responseText ?? ""}
              onChange={(e) => changeText(e.target.value)}
              placeholder="Write a structured answer…"
              rows={8}
              className="mt-4 w-full resize-y rounded-2xl border border-border bg-background p-3.5 text-sm leading-relaxed soft-inset focus:outline-none focus:ring-2 focus:ring-blue"
            />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {current.sourceRef || current.sourceDocument
                ? `Source: ${current.sourceRef || current.sourceDocument}`
                : ""}
            </span>
            {saveState === "saving" ? (
              <Chip tone="neutral">
                <Loader2 className="size-3 animate-spin" /> Saving…
              </Chip>
            ) : a.selectedOption || a.responseText ? (
              <Chip tone="mint">
                <Check className="size-3" /> Answer saved
              </Chip>
            ) : null}
          </div>
        </div>

        {/* Navigator */}
        <aside className="clay-card h-max bg-card p-4">
          <h3 className="font-display font-black">Question navigator</h3>
          <p className="text-xs text-muted-foreground">{saved.size} saved to flashcards</p>
          <div className="mt-3 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => goto(i)}
                aria-label={`Go to question ${i + 1}`}
                aria-current={i === index}
                className={`relative grid h-7 place-items-center rounded-lg text-[10px] font-black ${dotClass(
                  i === index,
                  Boolean(answers[q.id]?.selectedOption || answers[q.id]?.responseText?.trim()),
                  saved.has(q.id),
                )} ${answers[q.id]?.flagged ? "ring-2 ring-pink" : ""}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-yellow-soft p-3 text-[11px] leading-relaxed text-[color:var(--case-yellow-ink)]">
            💡 Your choices autosave. Correct answers are revealed after you submit.
          </div>
          <Button
            variant="blue"
            className="mt-3 w-full"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null} Submit exam
          </Button>
        </aside>
      </div>

      {/* Footer controls */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={index === 0} onClick={() => goto(index - 1)}>
          <ArrowLeft /> Previous
        </Button>
        <div className="flex gap-2">
          <Button variant={a.flagged ? "pink" : "secondary"} onClick={() => void flag()}>
            <Flag /> {a.flagged ? "Flagged" : "Flag"}
          </Button>
          <Button variant="yellow" onClick={() => setSheetOpen(true)}>
            <BookmarkPlus /> {saved.has(current.id) ? "Saved" : "Add to flashcards"}
          </Button>
          {index < questions.length - 1 ? (
            <Button variant="blue" onClick={() => goto(index + 1)}>
              Next <ArrowRight />
            </Button>
          ) : (
            <Button variant="blue" disabled={submitting} onClick={() => void submit()}>
              Finish <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {sheetOpen && (
        <FlashcardSaveSheet
          examId={examId}
          question={current}
          alreadySaved={saved.has(current.id)}
          onClose={() => setSheetOpen(false)}
          onSaved={(questionId) => setSaved((cur) => new Set(cur).add(questionId))}
        />
      )}
    </div>
  );
}

function answer(map: Record<string, LocalAnswer>, id: string): LocalAnswer {
  return map[id] ?? { selectedOption: null, responseText: null, flagged: false };
}

function dotClass(isCurrent: boolean, isAnswered: boolean, isSaved: boolean): string {
  if (isCurrent) return "bg-blue text-foreground";
  if (isSaved) return "bg-yellow text-[color:var(--case-yellow-ink)]";
  if (isAnswered) return "bg-mint text-foreground";
  return "bg-muted text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Flashcard save sheet (wireframes 6–7)
// ---------------------------------------------------------------------------
const DECK_SWATCHES = ["#ffe58a", "#ffb2c9", "#9bdbf6", "#bef0d6", "#d2b8fc"];

function FlashcardSaveSheet({
  examId,
  question,
  alreadySaved,
  onClose,
  onSaved,
}: {
  examId: string;
  question: TakingQuestion;
  alreadySaved: boolean;
  onClose: () => void;
  onSaved: (questionId: string) => void;
}) {
  const [decks, setDecks] = useState<ExamDeck[] | null>(null);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [newName, setNewName] = useState("");
  const [swatch, setSwatch] = useState(DECK_SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    listExamDecks()
      .then((d) => {
        setDecks(d);
        if (d.length === 0) setMode("create");
      })
      .catch((err) => {
        logProblem("List exam decks", err);
        setDecks([]);
        setMode("create");
      });
  }, []);

  const save = async (opts: { deckId?: string; newDeckName?: string }) => {
    setBusy(true);
    setError("");
    try {
      await addExamQuestionToDeck({ data: { examId, questionId: question.id, ...opts } });
      onSaved(question.id);
      setDone(true);
      window.setTimeout(onClose, 850);
    } catch (err) {
      logProblem("Add question to deck", err);
      setError(err instanceof Error ? err.message : "The question could not be saved.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save to flashcards"
        className="clay-card mobile-sheet max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-card p-6 sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[color:var(--case-yellow-ink)]">
              Study this again later
            </p>
            <h2 className="mt-1 font-display text-xl font-black">
              {mode === "create" ? "Create a deck" : "Save to flashcards"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-mint text-2xl">
              <Check className="text-[color:var(--case-mint-ink)]" />
            </span>
            <p className="mt-3 font-display font-black">Saved to flashcards</p>
          </div>
        ) : (
          <>
            {alreadySaved && mode === "pick" && (
              <p className="mt-2 rounded-xl bg-mint-soft p-2.5 text-xs font-semibold text-[color:var(--case-mint-ink)]">
                You’ve already saved this question to a deck — saving again adds it to another deck.
              </p>
            )}

            {mode === "pick" ? (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Choose an existing deck or make a new one.
                </p>
                <div className="mt-3 space-y-2">
                  {decks === null ? (
                    <div className="grid h-20 place-items-center">
                      <Loader2 className="size-5 animate-spin text-blue" />
                    </div>
                  ) : (
                    decks.map((deck) => (
                      <button
                        key={deck.id}
                        disabled={busy}
                        onClick={() => void save({ deckId: deck.id })}
                        className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 p-3 text-left hover:bg-muted"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-yellow text-lg">
                          <Layers3 size={18} className="text-[color:var(--case-yellow-ink)]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{deck.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {deck.cardCount} flashcards
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setMode("create")}
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-blue/50 p-3 text-sm font-extrabold text-blue"
                >
                  <span className="flex items-center gap-2">
                    <Plus size={16} /> Create a new deck
                  </span>
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Keep related questions together for spaced review.
                </p>
                <label className="mt-4 block text-sm font-extrabold">Deck name</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Heart failure — exam review"
                  className="mt-2 w-full rounded-2xl border border-border bg-background p-3 text-sm soft-inset focus:outline-none focus:ring-2 focus:ring-blue"
                />
                <p className="mt-4 text-sm font-extrabold">Choose a colour</p>
                <div className="mt-2 flex gap-3">
                  {DECK_SWATCHES.map((c) => (
                    <button
                      key={c}
                      aria-label={`Colour ${c}`}
                      onClick={() => setSwatch(c)}
                      className={`size-8 rounded-full ${swatch === c ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-yellow-soft p-3 text-xs text-[color:var(--case-yellow-ink)]">
                  🗂️ The card stores the question + answer. The answer stays hidden until you submit
                  the exam.
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  {(decks?.length ?? 0) > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setMode("pick")}>
                      Back
                    </Button>
                  )}
                  <Button
                    variant="yellow"
                    size="sm"
                    disabled={busy || newName.trim().length < 2}
                    onClick={() => void save({ newDeckName: newName.trim() })}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : null} Create &amp; save
                  </Button>
                </div>
              </>
            )}

            {error && (
              <p className="mt-3 text-sm font-semibold text-[color:var(--case-pink-ink)]">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
