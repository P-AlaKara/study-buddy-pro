import { Check, ClipboardCheck, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";
import type { OsceState } from "../engine.js";
import type { OsceStation } from "../schema.js";

export function ExaminerQuestions({
  game,
  station,
  onAnswer,
}: {
  game: OsceState;
  station: OsceStation;
  onAnswer: (questionId: string, selectedOptionIds: string[]) => void;
}) {
  const question = station.examinerQuestions[game.examinerAnswers.length];
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => setSelected([]), [question?.id]);

  if (!question) return null;

  function toggle(optionId: string) {
    if (question?.type === "single") {
      setSelected([optionId]);
      return;
    }
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((selectedId) => selectedId !== optionId)
        : [...current, optionId],
    );
  }

  return (
    <main className="osce-shell mx-auto max-w-5xl pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-pink">Station ended</p>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Examiner questions</h1>
        </div>
        <span className="rounded-full bg-yellow-soft px-4 py-2 text-xs font-black">
          Question {game.examinerAnswers.length + 1} of {station.examinerQuestions.length}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="clay-card bg-yellow-soft p-5 text-center">
          <DrAmbrose expression="thinking" className="mx-auto w-44 max-w-full" />
          <p className="mt-1 text-sm font-black">Dr. Ambrose</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Examiner
          </p>
        </aside>

        <section className="clay-card bg-card p-5 md:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lavender-soft">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                {question.type === "single" ? "Choose one" : "Select all that apply"}
              </p>
              <h2 className="mt-1 text-xl font-black leading-snug md:text-2xl">
                {question.prompt}
              </h2>
            </div>
          </div>

          <div
            className="mt-6 grid gap-3"
            role={question.type === "single" ? "radiogroup" : "group"}
            aria-label={question.prompt}
          >
            {question.options.map((option) => {
              const active = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role={question.type === "single" ? "radio" : "checkbox"}
                  aria-checked={active}
                  onClick={() => toggle(option.id)}
                  className={`flex items-start gap-3 rounded-[20px] border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${
                    active
                      ? "border-pink bg-pink-soft shadow-sm"
                      : "border-transparent bg-muted hover:bg-lavender-soft"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center ${
                      question.type === "single" ? "rounded-full" : "rounded-md"
                    } ${active ? "bg-pink text-white" : "bg-card shadow-inner"}`}
                    aria-hidden="true"
                  >
                    {active && <Check className="size-3.5" />}
                  </span>
                  <span className="font-bold leading-relaxed">{option.text}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!selected.length}
            onClick={() => onAnswer(question.id, selected)}
            className="clay-button mt-6 inline-flex items-center gap-2 bg-pink px-6 py-3 font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit answer <Send className="size-4" aria-hidden="true" />
          </button>
        </section>
      </div>

      <p className="mt-5 text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}
