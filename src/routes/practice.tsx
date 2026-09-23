import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/practice")({
  head: () => ({ meta: [
    { title: "Practice | Medley" },
    { name: "description", content: "Prepare for OSCEs, test your knowledge with quizzes, and review flashcards." },
    { property: "og:title", content: "Practice | Medley" },
    { property: "og:description", content: "Prepare for OSCEs, test your knowledge with quizzes, and review flashcards." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudyApp view="Practice" />,
});
