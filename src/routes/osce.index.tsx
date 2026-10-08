import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Stethoscope, Timer } from "lucide-react";
import { CHEST_TIGHTNESS_STATION } from "@/features/osce/stations";

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
  component: OsceRebuildShell,
});

function OsceRebuildShell() {
  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <section className="clay-card bg-pink-soft p-6 md:p-8">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-card shadow-sm">
          <Stethoscope aria-hidden="true" className="size-6 text-pink" />
        </div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-pink">OSCE V2</p>
        <h1 className="mt-2 text-3xl font-black">Conduct the consultation.</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Choose what to say, listen for cues, manage the clock and respond to the patient—just as
          you would in a real OSCE room.
        </p>
      </section>

      <section className="clay-card bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-mint">History taking</p>
            <h2 className="mt-1 text-2xl font-black">{CHEST_TIGHTNESS_STATION.title}</h2>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {CHEST_TIGHTNESS_STATION.setting} · {CHEST_TIGHTNESS_STATION.clockSeconds / 60}{" "}
              minutes
            </p>
          </div>
          <span className="rounded-full bg-yellow-soft px-3 py-1.5 text-xs font-black">
            Needs clinician review
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Take a focused history from Mr Daniel Otieno. The checklist stays hidden in Practice and
          Exam, and the patient&apos;s answers change with rapport.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ModeLink mode="learn" icon={BookOpen} label="Learn" detail="Live checklist · relaxed" />
          <ModeLink mode="practice" icon={Stethoscope} label="Practice" detail="Nudges · timed" />
          <ModeLink mode="exam" icon={Timer} label="Exam" detail="Strict · no nudges" />
        </div>
      </section>
      <p className="text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}

function ModeLink({
  mode,
  icon: Icon,
  label,
  detail,
}: {
  mode: "learn" | "practice" | "exam";
  icon: typeof ClipboardCheck;
  label: string;
  detail: string;
}) {
  return (
    <Link
      to="/osce/$stationId"
      params={{ stationId: CHEST_TIGHTNESS_STATION.id }}
      search={{ mode }}
      className="clay-button flex items-center gap-3 bg-lavender-soft p-4 text-left"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-black">{label}</span>
        <span className="block text-xs font-bold text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}
