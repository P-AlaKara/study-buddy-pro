import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  MessageCircleMore,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Timer,
} from "lucide-react";
import { DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";
import {
  emptyOsceProgress,
  loadOsceProgress,
  OSCE_RATING_LABELS,
  recommendedOsceMode,
  type OsceModeProgress,
  type OsceProgress,
} from "@/features/osce/progress";
import type { OsceMode } from "@/features/osce/schema";
import { OSCE_STATIONS } from "@/features/osce/stations";

export const Route = createFileRoute("/osce/")({
  head: () => ({
    meta: [
      { title: "OSCE practice | Medley" },
      {
        name: "description",
        content: "Conduct immersive, menu-driven clinical OSCE stations.",
      },
    ],
  }),
  component: OsceHub,
});

const INTRO_STORAGE_KEY = "medley-osce-intro";
const MODES: Array<{
  mode: OsceMode;
  label: string;
  detail: string;
  icon: typeof ClipboardCheck;
}> = [
  { mode: "learn", label: "Learn", detail: "Live checklist · relaxed clock", icon: BookOpen },
  { mode: "practice", label: "Practice", detail: "Timed · optional nudges", icon: Stethoscope },
  { mode: "exam", label: "Exam", detail: "Strict clock · no help", icon: Timer },
];

const COMING_SOON = [
  {
    title: "Examination",
    description: "Structured physical-examination stations with observable technique.",
    icon: Activity,
    tone: "bg-blue-soft text-sky-800",
  },
  {
    title: "Procedures",
    description: "Stepwise practical skills with safety gates and equipment choices.",
    icon: Syringe,
    tone: "bg-pink-soft text-red-800",
  },
  {
    title: "Communication",
    description: "Breaking bad news, consent and challenging conversations.",
    icon: MessageCircleMore,
    tone: "bg-yellow-soft text-amber-900",
  },
  {
    title: "Data interpretation",
    description: "Explain investigations, trends and clinical significance under pressure.",
    icon: ClipboardCheck,
    tone: "bg-lavender-soft text-lavender",
  },
] as const;

function OsceHub() {
  const [introExpanded, setIntroExpanded] = useState(true);
  const [progress, setProgress] = useState<OsceProgress>(() => emptyOsceProgress());

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(INTRO_STORAGE_KEY);
    if (savedPreference === null) {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "collapsed");
    } else {
      setIntroExpanded(savedPreference === "expanded");
    }
    setProgress(loadOsceProgress());
  }, []);

  function toggleIntro() {
    setIntroExpanded((expanded) => {
      const next = !expanded;
      window.localStorage.setItem(INTRO_STORAGE_KEY, next ? "expanded" : "collapsed");
      return next;
    });
  }

  return (
    <main className="osce-hub mx-auto max-w-6xl space-y-6 pb-8">
      <section className="clay-card overflow-hidden bg-yellow-soft" aria-labelledby="osce-title">
        <div
          className={`grid grid-cols-[auto_minmax(0,1fr)] items-center transition-[padding,gap] duration-200 ${introExpanded ? "gap-3 p-3 sm:gap-4 sm:p-4" : "gap-2 p-2 sm:gap-3 sm:p-3"}`}
        >
          <DrAmbrose
            expression={introExpanded ? "encouraging" : "neutral"}
            variant="logo"
            className={`${introExpanded ? "w-20 self-start sm:w-24" : "w-10 sm:w-12"} transition-[width] duration-200`}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h1
                id="osce-title"
                className={`${introExpanded ? "text-xl sm:text-2xl" : "truncate text-sm sm:text-base"} font-black`}
              >
                Conduct the consultation
              </h1>
              <button
                type="button"
                aria-expanded={introExpanded}
                aria-controls="osce-intro-content"
                onClick={toggleIntro}
                className="clay-button inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-2 text-[10px] font-black text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:px-3 sm:text-xs"
              >
                {introExpanded ? "Hide" : "Show guide"}
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${introExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div
              id="osce-intro-content"
              aria-hidden={!introExpanded}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${introExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="case-speech-bubble mt-3 rounded-[20px] bg-card p-3.5 sm:p-4">
                  <p className="text-sm font-black leading-relaxed text-foreground">
                    You are the doctor. Choose what to say, listen for cues, prioritise safety and
                    manage the clock while I observe.
                  </p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      "Learn the structure with visible coaching.",
                      "Practise with a hidden checklist and optional nudges.",
                      "Sit the strict exam when you are ready.",
                    ].map((step, index) => (
                      <li
                        key={step}
                        className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2 text-xs font-bold leading-relaxed"
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-mint-soft text-[10px] font-black text-mint">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="history-stations-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-mint">
              Available now
            </p>
            <h2 id="history-stations-title" className="mt-1 text-2xl font-black">
              History taking
            </h2>
          </div>
          <p className="max-w-lg text-right text-xs font-bold text-muted-foreground">
            Best results stay on this device. Progress through the modes in order, or choose any
            mode whenever you like.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {OSCE_STATIONS.map((station) => {
            const stationProgress = progress.stations[station.id];
            const recommendation = recommendedOsceMode(stationProgress);
            return (
              <article key={station.id} className="clay-card overflow-hidden bg-card p-5 md:p-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-mint">
                          Medical outpatient clinic
                        </p>
                        <h3 className="mt-1 text-2xl font-black">{station.title}</h3>
                        <p className="mt-1 text-sm font-bold text-muted-foreground">
                          {station.clockSeconds / 60} minutes · {station.cards.length} choices · 3
                          examiner questions
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-soft px-3 py-1.5 text-xs font-black">
                        <ShieldCheck className="size-3.5" aria-hidden="true" /> Needs clinician
                        review
                      </span>
                    </div>
                    <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-muted-foreground">
                      Take a focused history from Mr Daniel Otieno. His answers change with rapport,
                      cues expire, and not everything can be covered before the bell.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {MODES.map((mode) => (
                        <ModeLink
                          key={mode.mode}
                          stationId={station.id}
                          {...mode}
                          progress={stationProgress?.[mode.mode]}
                          recommended={recommendation === mode.mode}
                        />
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-[24px] bg-mint-soft p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-mint">
                      Suggested next
                    </p>
                    <p className="mt-1 text-xl font-black capitalize">{recommendation}</p>
                    <p className="mt-2 text-xs font-bold leading-relaxed text-muted-foreground">
                      {recommendation === "learn"
                        ? "See the checklist and let Dr. Ambrose coach your structure."
                        : recommendation === "practice"
                          ? "Hide the checklist and build fluency with optional nudges."
                          : "Test your structure under strict timing with no assistance."}
                    </p>
                    <div className="mt-4 space-y-2">
                      {MODES.map(({ mode, label }) => (
                        <div
                          key={mode}
                          className="flex items-center justify-between rounded-2xl bg-card/75 px-3 py-2 text-xs"
                        >
                          <span className="font-black">{label}</span>
                          <span className="font-bold text-muted-foreground">
                            {stationProgress?.[mode]
                              ? `${OSCE_RATING_LABELS[stationProgress[mode]!.bestRating]} · ${stationProgress[mode]!.bestComposite}%`
                              : "Not attempted"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="coming-soon-title">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-lavender">
            Station bank
          </p>
          <h2 id="coming-soon-title" className="mt-1 text-2xl font-black">
            Coming soon
          </h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON.map(({ title, description, icon: Icon, tone }) => (
            <article key={title} aria-disabled="true" className="clay-card bg-card p-5 opacity-75">
              <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-black">{title}</h3>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                {description}
              </p>
              <span className="mt-4 inline-flex rounded-full bg-muted px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                Coming soon
              </span>
            </article>
          ))}
        </div>
      </section>

      <p className="text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}

function ModeLink({
  stationId,
  mode,
  icon: Icon,
  label,
  detail,
  progress,
  recommended,
}: {
  stationId: string;
  mode: OsceMode;
  icon: typeof ClipboardCheck;
  label: string;
  detail: string;
  progress: OsceModeProgress | undefined;
  recommended: boolean;
}) {
  return (
    <Link
      to="/osce/$stationId"
      params={{ stationId }}
      search={{ mode }}
      className={`clay-button relative flex items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${recommended ? "bg-pink-soft ring-2 ring-pink/25" : "bg-lavender-soft"}`}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-pink px-2 py-1 text-[8px] font-black uppercase tracking-wider text-primary-foreground shadow-sm">
          Recommended
        </span>
      )}
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-black">{label}</span>
        <span className="block text-[11px] font-bold text-muted-foreground">{detail}</span>
        <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-mint">
          {progress
            ? `Best: ${OSCE_RATING_LABELS[progress.bestRating]} · ${progress.bestComposite}% · ${progress.attempts} ${progress.attempts === 1 ? "attempt" : "attempts"}`
            : "No result yet"}
        </span>
      </span>
    </Link>
  );
}
