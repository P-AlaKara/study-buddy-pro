import { Bell, Clock3, DoorOpen, FileText, Stethoscope } from "lucide-react";
import type { OsceMode, OsceStation } from "../schema.js";

const MODE_COPY: Record<OsceMode, { label: string; detail: string }> = {
  learn: { label: "Learn", detail: "Live checklist, relaxed clock and coaching" },
  practice: { label: "Practice", detail: "Hidden checklist, timed room and optional nudges" },
  exam: { label: "Exam", detail: "Strict clock, hidden checklist and no nudges" },
};

export function DoorScreen({
  station,
  mode,
  readingSecondsRemaining,
  onSkipReading,
  onEnter,
}: {
  station: OsceStation;
  mode: OsceMode;
  readingSecondsRemaining: number;
  onSkipReading: () => void;
  onEnter: () => void;
}) {
  const readingComplete = readingSecondsRemaining <= 0;
  const minutes = Math.floor(readingSecondsRemaining / 60);
  const seconds = String(readingSecondsRemaining % 60).padStart(2, "0");

  return (
    <main className="osce-shell mx-auto max-w-5xl pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-pink">OSCE station</p>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Outside the consultation room</h1>
        </div>
        <span className="rounded-full bg-lavender-soft px-4 py-2 text-xs font-black uppercase tracking-wider">
          {MODE_COPY[mode].label} mode
        </span>
      </div>

      <section className="osce-door-card clay-card overflow-hidden bg-card">
        <div className="grid md:grid-cols-[0.8fr_1.2fr]">
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden bg-lavender-soft p-8">
            <div className="osce-door relative h-52 w-36 rounded-t-[5rem] rounded-b-2xl bg-pink p-3 shadow-xl">
              <div className="flex h-full items-center justify-center rounded-t-[4.3rem] rounded-b-xl bg-pink-soft shadow-inner">
                <DoorOpen className="size-14 text-pink" aria-hidden="true" />
              </div>
              <span className="absolute right-5 top-1/2 size-3 rounded-full bg-yellow shadow-sm" />
            </div>
            <span className="absolute bottom-5 left-5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-extrabold shadow-sm">
              {station.setting}
            </span>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Candidate instructions
                </p>
                <h2 className="mt-2 font-display text-2xl font-black">{station.title}</h2>
              </div>
              <div
                className={`shrink-0 rounded-2xl px-4 py-3 text-center shadow-inner ${readingComplete ? "bg-mint-soft" : "bg-yellow-soft"}`}
                aria-live="polite"
              >
                <Clock3 className="mx-auto size-4" aria-hidden="true" />
                <p className="mt-1 font-mono text-xl font-black">
                  {minutes}:{seconds}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider">
                  {readingComplete ? "Ready" : "Reading"}
                </p>
              </div>
            </div>

            <p className="mt-5 text-base font-semibold leading-relaxed text-foreground/85">
              {station.candidateInstructions}
            </p>

            <div className="mt-5 rounded-2xl bg-blue-soft p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-foreground/70">
                <FileText className="size-4" aria-hidden="true" /> Examiner&apos;s note
              </p>
              <p className="mt-1 text-sm font-bold">{station.examinerNote}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs font-extrabold text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                <Stethoscope className="size-3.5" aria-hidden="true" /> Focused history
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" /> {station.clockSeconds / 60}{" "}
                minutes
              </span>
            </div>

            <p className="mt-5 text-sm font-bold text-muted-foreground">{MODE_COPY[mode].detail}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onEnter}
                className={`clay-button inline-flex items-center gap-2 bg-pink px-6 py-3 font-black text-primary-foreground ${readingComplete ? "osce-enter-ready" : ""}`}
              >
                <Bell className="osce-bell size-5" aria-hidden="true" /> Enter the room
              </button>
              {!readingComplete && (
                <button
                  type="button"
                  onClick={onSkipReading}
                  className="rounded-full bg-muted px-5 py-3 text-sm font-extrabold transition-transform active:scale-95"
                >
                  Skip reading time
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-5 text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}
