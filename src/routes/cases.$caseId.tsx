import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CaseChallengeScreen } from "@/features/case-challenge/components/case-challenge-screen";
import { CaseMascotState } from "@/features/case-challenge/components/dr-ambrose";
import { getPublishedCase } from "@/features/case-challenge/cases.functions";

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
  loader: ({ params }) => getPublishedCase({ data: { idOrSlug: params.caseId } }),
  pendingComponent: CaseLoading,
  component: CasePlayer,
});

function CasePlayer() {
  const playable = Route.useLoaderData();

  if (!playable) {
    return (
      <section className="case-panel mx-auto max-w-xl p-8 text-center">
        <CaseMascotState title="Case not found" expression="concerned">
          This case is not in the case library. It may have been removed.
        </CaseMascotState>
        <Link to="/cases" className="case-primary-button mt-6 inline-flex px-5 py-3">
          <ArrowLeft className="size-4" /> Back to cases
        </Link>
      </section>
    );
  }

  return (
    <CaseChallengeScreen
      key={playable.definition.id}
      caseDefinition={playable.definition}
      nextCase={playable.nextCase}
    />
  );
}

function CaseLoading() {
  return (
    <section className="case-panel mx-auto max-w-xl p-8">
      <CaseMascotState title="Opening the patient chart" expression="thinking">
        Review the handover while I prepare the clinical cockpit.
      </CaseMascotState>
    </section>
  );
}
