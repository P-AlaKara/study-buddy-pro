import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";
import { CaseChallengeScreen } from "@/features/case-challenge/components/case-challenge-screen";
import { getCaseById } from "@/features/case-challenge/cases";

export const Route = createFileRoute("/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Solve a clinical case | Medley" },
      {
        name: "description",
        content:
          "Investigate a time-sensitive patient case, build your differential and commit to a management plan.",
      },
      { property: "og:title", content: "Solve a clinical case | Medley" },
      {
        property: "og:description",
        content: "Make clinical decisions under pressure and receive a scored debrief.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasePlayer,
});

function CasePlayer() {
  const { caseId } = Route.useParams();
  const caseDefinition = getCaseById(caseId);

  if (!caseDefinition) {
    return (
      <section className="case-panel mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-red-50 text-red-700">
          <SearchX className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-black">Case not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This case is not in the current two-case challenge bank.
        </p>
        <Link to="/cases" className="case-primary-button mt-6 inline-flex px-5 py-3">
          <ArrowLeft className="size-4" /> Back to cases
        </Link>
      </section>
    );
  }

  return <CaseChallengeScreen caseDefinition={caseDefinition} />;
}
