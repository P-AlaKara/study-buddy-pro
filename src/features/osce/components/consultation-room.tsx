import { Check, ChevronUp, Clock3, Flag, Lightbulb, MessageCircleMore } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";
import { PatientAvatar } from "@/features/case-challenge/components/patient-avatar";
import type {
  CasePatient,
  PatientExpression as CasePatientExpression,
} from "@/features/case-challenge/schema";
import { formatOsceClock, type OsceState } from "../engine.js";
import type {
  OsceCard,
  OsceCategory,
  OsceMode,
  OsceStation,
  PatientExpression,
} from "../schema.js";
import { QuestionMenu } from "./question-menu.js";

function caseExpression(expression: PatientExpression): CasePatientExpression {
  if (
    expression === "neutral" ||
    expression === "in_pain" ||
    expression === "anxious" ||
    expression === "relieved"
  ) {
    return expression;
  }
  return "anxious";
}

function patientForAvatar(station: OsceStation): CasePatient {
  return {
    name: station.patient.name,
    age: station.patient.age,
    sex: station.patient.sex,
    avatar: station.patient.avatar,
    personality: station.patient.personality,
    chiefComplaint: station.title,
    initialExpression: caseExpression(station.patient.initialExpression),
  };
}

export function ConsultationRoom({
  game,
  station,
  mode,
  category,
  pendingCardId,
  onCategoryChange,
  onChoose,
  onEnd,
  onNudge,
  onActivity,
}: {
  game: OsceState;
  station: OsceStation;
  mode: OsceMode;
  category: OsceCategory;
  pendingCardId: string | null;
  onCategoryChange: (category: OsceCategory) => void;
  onChoose: (card: OsceCard) => void;
  onEnd: () => void;
  onNudge: () => void;
  onActivity: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const patient = patientForAvatar(station);
  const lastNudge = game.nudgesUsed.at(-1);
  const nextNudge = station.nudges[game.nudgesUsed.length];
  const warning =
    game.remainingSeconds <= 30 ? "final" : game.remainingSeconds <= 120 ? "soon" : null;

  function chooseFromMobile(card: OsceCard) {
    setMenuOpen(false);
    onChoose(card);
  }

  return (
    <main className="osce-shell osce-room mx-auto max-w-7xl pb-24 lg:pb-8">
      <header
        className={`osce-room-header sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-3 rounded-[24px] p-3.5 shadow-lg backdrop-blur-md md:p-4 ${
          warning === "final"
            ? "bg-pink text-primary-foreground"
            : warning === "soon"
              ? "bg-yellow-soft"
              : "bg-card/95"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-foreground">
              {mode}
            </span>
            <span className="truncate text-current/70">{station.title}</span>
          </div>
          {warning && (
            <p className="mt-1 text-xs font-black" role="status">
              {warning === "final" ? "Final 30 seconds" : "Two minutes remaining"}
            </p>
          )}
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl bg-background/85 px-4 py-2 text-foreground shadow-inner"
          aria-label={`${formatOsceClock(game.remainingSeconds)} remaining`}
          aria-live="polite"
        >
          <Clock3 className="size-5" aria-hidden="true" />
          <span className="font-mono text-2xl font-black tabular-nums">
            {formatOsceClock(game.remainingSeconds)}
          </span>
        </div>
        {mode !== "exam" && nextNudge && (
          <button
            type="button"
            disabled={pendingCardId !== null}
            onClick={() => {
              onActivity();
              onNudge();
            }}
            className="clay-button inline-flex items-center gap-1.5 bg-lavender-soft px-4 py-2.5 text-xs font-black disabled:opacity-50"
          >
            <Lightbulb className="size-4" aria-hidden="true" />
            {mode === "learn" ? "Coach tip" : `Nudge · −${nextNudge.pointCost}`}
          </button>
        )}
        <button
          type="button"
          disabled={pendingCardId !== null}
          onClick={onEnd}
          className="rounded-full bg-foreground px-4 py-2.5 text-xs font-black text-background transition-transform active:scale-95 disabled:opacity-50"
        >
          <Flag className="mr-1.5 inline size-3.5" aria-hidden="true" /> End consultation
        </button>
      </header>

      <div className={`grid gap-4 ${mode === "learn" ? "xl:grid-cols-[minmax(0,1fr)_19rem]" : ""}`}>
        <div className="space-y-4">
          <section className="clay-card relative overflow-hidden bg-blue-soft p-4 md:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-pink-soft/80" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-mint-soft/80" />

            <div className="relative grid grid-cols-2 items-end gap-3 md:grid-cols-[14rem_minmax(0,1fr)_11rem] md:gap-5">
              <div className="col-start-1 row-start-2 md:row-start-1">
                <PatientAvatar
                  patient={patient}
                  expression={caseExpression(game.patientExpression)}
                  respiratoryRate={18}
                  className="max-w-36 md:max-w-52"
                />
                <div className="-mt-1 text-center">
                  <p className="text-sm font-black">{station.patient.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {station.patient.age} · {station.patient.sex}
                  </p>
                </div>
              </div>

              <div className="col-span-2 col-start-1 row-start-1 self-center md:col-span-1 md:col-start-2">
                <div
                  className="osce-patient-bubble case-speech-bubble min-h-32 rounded-[26px] bg-card p-5 md:min-h-44 md:p-6"
                  aria-live="polite"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-mint">
                    Patient
                  </p>
                  {pendingCardId ? (
                    <div className="flex min-h-20 flex-col items-center justify-center text-center">
                      <span className="flex gap-1.5" aria-label="Patient is answering">
                        {[0, 1, 2].map((index) => (
                          <span
                            key={index}
                            className="case-typing-dot size-2.5 rounded-full bg-mint"
                            style={{ animationDelay: `${index * 140}ms` }}
                          />
                        ))}
                      </span>
                      <span className="mt-3 text-xs font-bold text-muted-foreground">
                        {station.patient.name} is answering…
                      </span>
                    </div>
                  ) : (
                    <p className="mt-3 whitespace-pre-line text-base font-bold leading-relaxed md:text-lg">
                      “{game.latestPatientLine}”
                    </p>
                  )}
                </div>
              </div>

              <aside className="col-start-2 row-start-2 self-end md:col-start-3 md:row-start-1">
                {lastNudge && (
                  <div className="osce-examiner-bubble mb-2 rounded-2xl bg-yellow-soft p-3 text-xs font-bold leading-relaxed shadow-sm">
                    {lastNudge.text}
                  </div>
                )}
                <DrAmbrose expression="neutral" className="mx-auto w-24 md:w-40" />
                <div className="-mt-1 text-center">
                  <p className="text-xs font-black">Dr. Ambrose</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {mode === "learn" ? "Coach" : "Examiner"}
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <div className="hidden lg:block">
            <QuestionMenu
              game={game}
              station={station}
              mode={mode}
              category={category}
              onCategoryChange={(nextCategory) => {
                onActivity();
                onCategoryChange(nextCategory);
              }}
              onChoose={onChoose}
              pendingCardId={pendingCardId}
            />
          </div>
        </div>

        {mode === "learn" && <LearnChecklist game={game} station={station} />}
      </div>

      <button
        type="button"
        onClick={() => {
          onActivity();
          setMenuOpen(true);
        }}
        className="osce-mobile-launcher clay-button fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center justify-between bg-pink px-5 py-3.5 text-primary-foreground shadow-xl lg:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-black">
          <MessageCircleMore className="size-5" aria-hidden="true" /> Choose what to say or do
        </span>
        <ChevronUp className="size-5" aria-hidden="true" />
      </button>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[72dvh] overflow-y-auto rounded-t-[28px] border-0 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Question menu</SheetTitle>
            <SheetDescription>Choose what to say or do next.</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
          <QuestionMenu
            game={game}
            station={station}
            mode={mode}
            category={category}
            onCategoryChange={(nextCategory) => {
              onActivity();
              onCategoryChange(nextCategory);
            }}
            onChoose={chooseFromMobile}
            pendingCardId={pendingCardId}
            compact
          />
        </SheetContent>
      </Sheet>

      <p className="mt-5 text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}

function LearnChecklist({ game, station }: { game: OsceState; station: OsceStation }) {
  const penalties = new Set(game.checklistPenalties.map((penalty) => penalty.checklistItemId));
  return (
    <aside className="clay-card h-fit bg-mint-soft p-4 xl:sticky xl:top-28">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-mint">Learn checklist</p>
      <h2 className="mt-1 text-lg font-black">Your live structure</h2>
      <p className="mt-1 text-xs font-bold text-muted-foreground">
        Visible only in Learn mode. A crossed item was later undermined by poor technique.
      </p>
      <div className="mt-4 max-h-[65dvh] space-y-2 overflow-y-auto pr-1">
        {station.checklist.map((item) => {
          const found = Boolean(game.checklistAchievements[item.id]);
          const penalised = penalties.has(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-start gap-2 rounded-2xl p-2.5 text-xs font-bold ${
                found && !penalised
                  ? "bg-card text-foreground shadow-sm"
                  : "bg-background/55 text-muted-foreground"
              }`}
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
                  found && !penalised ? "bg-mint text-white" : "bg-muted"
                }`}
                aria-hidden="true"
              >
                {found && !penalised && <Check className="size-3" />}
              </span>
              <span className={penalised ? "line-through" : ""}>{item.label}</span>
              <span className="sr-only">
                {found && !penalised ? "Completed" : penalised ? "Penalised" : "Not completed"}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
