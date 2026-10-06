import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CaseChallengeScreen } from "@/features/case-challenge/components/case-challenge-screen";
import { CaseMascotState } from "@/features/case-challenge/components/dr-ambrose";
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
  pendingComponent: CaseLoading,
  component: CasePlayer,
});

function CasePlayer() {
  const { caseId } = Route.useParams();
  const caseDefinition = getCaseById(caseId);

  if (!caseDefinition) {
    return (
      <section className="case-panel mx-auto max-w-xl p-8 text-center">
        <CaseMascotState title="Case not found" expression="concerned">
          This case is not in the current two-case challenge bank.
        </CaseMascotState>
        <Link to="/cases" className="case-primary-button mt-6 inline-flex px-5 py-3">
          <ArrowLeft className="size-4" /> Back to cases
        </Link>
      </section>
    );
  }

  return <CaseChallengeScreen caseDefinition={caseDefinition} />;
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
