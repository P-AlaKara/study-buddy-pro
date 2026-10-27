import { createFileRoute, notFound } from "@tanstack/react-router";
import { STUDY_WITH_ANNIE_ENABLED } from "@/features/study-with-annie/feature-flag";
import { AnnieReader } from "@/features/study-with-annie/reader";
import { AnnieShell } from "@/features/study-with-annie/annie-shell";

export const Route = createFileRoute("/study-with-annie/$documentId")({
  beforeLoad: () => {
    if (!STUDY_WITH_ANNIE_ENABLED) throw notFound();
  },
  head: () => ({ meta: [{ title: "Reading with Annie | Medley" }] }),
  component: AnnieReaderPage,
});

function AnnieReaderPage() {
  const { documentId } = Route.useParams();
  return (
    <AnnieShell compact>
      <AnnieReader documentId={documentId} />
    </AnnieShell>
  );
}
