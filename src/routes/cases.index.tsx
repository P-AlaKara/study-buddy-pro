import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, ChevronDown, Stethoscope } from "lucide-react";
import { CASE_BANK } from "@/features/case-challenge/cases";
import { CaseMascotState, DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";
import { CASE_LIBRARY_INSTRUCTIONS } from "@/features/case-challenge/config";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Clinical case challenges | Medley" },
      {
        name: "description",
        content:
          "Investigate realistic emergencies, manage deterioration and receive a scored clinical debrief.",
      },
      { property: "og:title", content: "Clinical case challenges | Medley" },
      {
        property: "og:description",
        content: "Make time-sensitive clinical decisions in two replayable cases.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: CasesLoading,
  component: CaseLibrary,
});

type DifficultyFilter = "all" | "2" | "3";
const INSTRUCTIONS_STORAGE_KEY = "medley-case-instructions";

function CaseLibrary() {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [specialty, setSpecialty] = useState("all");
  const [instructionsExpanded, setInstructionsExpanded] = useState(true);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(INSTRUCTIONS_STORAGE_KEY);
    if (savedPreference === null) {
      // First visit starts open; future visits default to the compact strip.
      window.localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, "collapsed");
      return;
    }
    setInstructionsExpanded(savedPreference === "expanded");
  }, []);

  function toggleInstructions() {
    setInstructionsExpanded((expanded) => {
      const next = !expanded;
      window.localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, next ? "expanded" : "collapsed");
      return next;
    });
  }

  const specialties = useMemo(
    () => ["all", ...new Set(CASE_BANK.flatMap((item) => item.specialty))],
    [],
  );
  const shown = CASE_BANK.filter(
    (item) =>
      (difficulty === "all" || item.difficulty === Number(difficulty)) &&
      (specialty === "all" || item.specialty.includes(specialty)),
  );

  return (
    <div className="case-cockpit space-y-6 pb-8">
      <section
        className="case-panel overflow-hidden bg-yellow-soft"
        aria-labelledby="case-instructions-title"
      >
        <div
          className={`grid grid-cols-[auto_minmax(0,1fr)] items-center transition-[padding,gap] duration-200 ${instructionsExpanded ? "gap-3 p-3 sm:gap-4 sm:p-4" : "gap-2 p-2 sm:gap-3 sm:p-3"}`}
        >
          <DrAmbrose
            expression={instructionsExpanded ? "encouraging" : "neutral"}
            variant="logo"
            className={`${instructionsExpanded ? "w-20 self-start sm:w-24" : "w-10 sm:w-12"} transition-[width] duration-200`}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h1
                id="case-instructions-title"
                className={`${instructionsExpanded ? "text-xl sm:text-2xl" : "truncate text-sm sm:text-base"} font-display font-black text-slate-900`}
              >
                {CASE_LIBRARY_INSTRUCTIONS.title}
              </h1>
              <button
                type="button"
                aria-expanded={instructionsExpanded}
                aria-controls="case-instructions-content"
                onClick={toggleInstructions}
                className="clay-button inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-2 text-[10px] font-black text-[#0d686d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91] focus-visible:ring-offset-2 sm:px-3 sm:text-xs"
              >
                {instructionsExpanded ? "Hide" : "Show instructions"}
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${instructionsExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div
              id="case-instructions-content"
              aria-hidden={!instructionsExpanded}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${instructionsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="case-speech-bubble mt-3 rounded-[20px] bg-white p-3.5 sm:p-4">
                  <p className="text-sm font-extrabold leading-relaxed text-slate-700">
                    {CASE_LIBRARY_INSTRUCTIONS.intro}
                  </p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {CASE_LIBRARY_INSTRUCTIONS.steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex items-start gap-2 rounded-2xl bg-[#f8f6f0] px-3 py-2 text-xs font-bold leading-relaxed text-slate-700"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-5 shrink-0 place-items-center rounded-full bg-[#dff4f1] text-[10px] font-black text-[#0d686d]"
                        >
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="case-bank-title">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#168d91]">
              Current case bank
            </p>
            <h2 id="case-bank-title" className="mt-1 text-2xl font-black">
              Choose your shift
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "2", "3"] as const).map((value) => (
              <FilterChip
                key={value}
                active={difficulty === value}
                onClick={() => setDifficulty(value)}
              >
                {value === "all" ? "Any difficulty" : `Level ${value}`}
              </FilterChip>
            ))}
            <select
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              aria-label="Filter cases by specialty"
              className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-[#168d91]"
            >
              {specialties.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All specialties" : value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {shown.map((item, index) => (
            <Link
              key={item.id}
              to="/cases/$caseId"
              params={{ caseId: item.id }}
              className="case-panel group block overflow-hidden p-5 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91] md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl ${index === 0 ? "bg-[#dff4f1] text-[#107b80]" : "bg-[#fff0ec] text-[#b64e3a]"}`}
                >
                  {index === 0 ? (
                    <Activity className="size-6" />
                  ) : (
                    <Stethoscope className="size-6" />
                  )}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Level {item.difficulty}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-900">{item.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-slate-500">
                {item.intro}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-extrabold text-slate-600">
                  {item.setting}
                </span>
                {item.specialty.slice(0, 2).map((specialtyName) => (
                  <span
                    key={specialtyName}
                    className="rounded-full bg-[#eeeafd] px-3 py-1 text-[10px] font-extrabold text-[#5b50a3]"
                  >
                    {specialtyName}
                  </span>
                ))}
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#107b80]">
                Start case
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>

        {shown.length === 0 && (
          <div className="case-panel mt-5 p-8 text-center">
            <CaseMascotState title="No cases match those filters" expression="thinking">
              Try a broader specialty or difficulty. I&apos;ll keep the handover ready.
            </CaseMascotState>
            <button
              type="button"
              onClick={() => {
                setDifficulty("all");
                setSpecialty("all");
              }}
              className="mt-3 text-sm font-black text-[#107b80] underline underline-offset-4"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] font-bold text-slate-500">
        Educational use only, not medical advice · Demo cases are clinician reviewed.
      </p>
    </div>
  );
}

function CasesLoading() {
  return (
    <section className="case-panel mx-auto max-w-xl p-8">
      <CaseMascotState title="Preparing the case bank" expression="thinking">
        I&apos;m checking the handover notes and getting the patient bay ready.
      </CaseMascotState>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168d91] ${active ? "bg-[#168d91] text-white" : "bg-white text-slate-600 shadow-sm"}`}
    >
      {children}
    </button>
  );
}
