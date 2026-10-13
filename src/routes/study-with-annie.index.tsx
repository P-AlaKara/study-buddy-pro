import { createFileRoute, notFound } from "@tanstack/react-router";
import { AnnieAuthGate } from "@/features/study-with-annie/auth-gate";
import { STUDY_WITH_ANNIE_ENABLED } from "@/features/study-with-annie/feature-flag";
import { AnnieLibrary } from "@/features/study-with-annie/library";
import { AnnieShell } from "@/features/study-with-annie/annie-shell";

export const Route = createFileRoute("/study-with-annie/")({
  beforeLoad: () => {
    if (!STUDY_WITH_ANNIE_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Study with Annie | Medley" },
      {
        name: "description",
        content: "Read and annotate your PDF notes with an AI study companion.",
      },
    ],
  }),
  component: StudyWithAnniePage,
});

function StudyWithAnniePage() {
  return (
    <AnnieShell>
      <AnnieAuthGate>{() => <AnnieLibrary />}</AnnieAuthGate>
    </AnnieShell>
  );
}
