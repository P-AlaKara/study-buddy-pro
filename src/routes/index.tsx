import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Your study space | Medley" },
    { name: "description", content: "Plan your medical studies with cases, practice, progress, and a friendly study community." },
    { property: "og:title", content: "Your study space | Medley" },
    { property: "og:description", content: "Plan your medical studies with cases, practice, progress, and a friendly study community." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudyApp view="home" />,
});
