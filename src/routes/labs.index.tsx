import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";
import { LabsHub } from "@/features/labs/labs-hub";

// No labs.tsx layout on purpose: the hub sits in the study shell, while each lab
// (e.g. labs.anatomy.tsx) is a full-viewport experience outside it.
export const Route = createFileRoute("/labs/")({
  head: () => ({
    meta: [
      { title: "Labs | Medley" },
      {
        name: "description",
        content:
          "Interactive labs for medical students: explore 3D anatomy now, with pathology and pharmacology on the way.",
      },
    ],
  }),
  component: () => (
    <StudyApp view="labs">
      <LabsHub />
    </StudyApp>
  ),
});
