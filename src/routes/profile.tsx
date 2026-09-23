import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "Student profile | Medley" },
    { name: "description", content: "See your medical studies, goals, strengths, and learning progress." },
    { property: "og:title", content: "Student profile | Medley" },
    { property: "og:description", content: "See your medical studies, goals, strengths, and learning progress." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudyApp view="Profile" />,
});
