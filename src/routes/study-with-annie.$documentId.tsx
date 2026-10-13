import { createFileRoute } from "@tanstack/react-router";
import { AnnieAuthGate } from "@/features/study-with-annie/auth-gate";
import { AnnieReader } from "@/features/study-with-annie/reader";
import { AnnieShell } from "@/features/study-with-annie/annie-shell";

export const Route = createFileRoute("/study-with-annie/$documentId")({
  head: () => ({ meta: [{ title: "Reading with Annie | Medley" }] }),
  component: AnnieReaderPage,
});

function AnnieReaderPage() {
  const { documentId } = Route.useParams();
  return (
    <AnnieShell compact>
      <AnnieAuthGate>{() => <AnnieReader documentId={documentId} />}</AnnieAuthGate>
    </AnnieShell>
  );
}
