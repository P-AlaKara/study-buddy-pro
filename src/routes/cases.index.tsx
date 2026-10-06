import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Clock3, ShieldCheck, Stethoscope } from "lucide-react";
import { CASE_BANK } from "@/features/case-challenge/cases";
import { CaseMascotState, DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";

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

function CaseLibrary() {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [specialty, setSpecialty] = useState("all");
  const specialties = useMemo(
    () => ["all", ...new Set(CASE_BANK.flatMap((item) => item.specialty))],
    [],
  );
  const shown = CASE_BANK.filter(
    (item) =>
      (difficulty === "all" || item.difficulty === Number(difficulty)) &&
      (specialty === "all" || item.specialty.includes(specialty)),
  );
  const spotlight = CASE_BANK[0];

  return (
    <div className="case-cockpit mx-auto max-w-6xl space-y-8 pb-8">
      <section className="case-panel relative isolate overflow-hidden bg-[#173d42] p-6 text-white md:p-9">
        <div className="absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="absolute -bottom-32 right-24 -z-10 size-64 rounded-full bg-amber-300/10 blur-2xl" />
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            Solve the medical case
          </p>
          <h1 className="mt-3 font-display text-3xl font-black leading-tight md:text-5xl">
            The chart won&apos;t tell you what matters. Your decisions will.
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-white/72 md:text-base">
            Question the patient, uncover evidence, protect them from deterioration and commit when
            your reasoning is ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-extrabold text-white/78">
            <FeaturePill icon={<Clock3 className="size-4" />}>Time-sensitive</FeaturePill>
            <FeaturePill icon={<Activity className="size-4" />}>Live vitals</FeaturePill>
            <FeaturePill icon={<ShieldCheck className="size-4" />}>Safety gates</FeaturePill>
          </div>
        </div>
      </section>

      <section className="case-panel grid overflow-hidden bg-[#e4f6f3] md:grid-cols-[1fr_auto]">
        <div className="p-6 md:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#107b80]">
            Recommended first case
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{spotlight.title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600">
            {spotlight.intro}
          </p>
          <Link
            to="/cases/$caseId"
            params={{ caseId: spotlight.id }}
            className="case-primary-button mt-5 inline-flex px-5 py-3"
          >
            Enter the ER <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid min-w-56 place-items-center bg-[#cceee9] px-6 pt-4">
          <DrAmbrose expression="encouraging" className="w-44 max-w-full" />
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

function FeaturePill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
      {icon}
      {children}
    </span>
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
