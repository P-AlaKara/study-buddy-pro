import { createFileRoute } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";

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
    <main className="mx-auto max-w-3xl space-y-5">
      <section className="clay-card bg-pink-soft p-6 md:p-8">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-card shadow-sm">
          <Stethoscope aria-hidden="true" className="size-6 text-pink" />
        </div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-pink">OSCE V2</p>
        <h1 className="mt-2 text-3xl font-black">The new consultation room is being prepared.</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          The legacy checklist simulator has been retired. A fully interactive history-taking
          station will appear here in the next build phase.
        </p>
      </section>
      <p className="text-center text-xs font-bold text-muted-foreground">
        Educational use only, not medical advice
      </p>
    </main>
  );
}
