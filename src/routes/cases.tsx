import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/cases")({
  head: () => ({ meta: [
    { title: "Clinical cases | Medley" },
    { name: "description", content: "Explore clinical reasoning cases and the weekly patient scenario." },
    { property: "og:title", content: "Clinical cases | Medley" },
    { property: "og:description", content: "Explore clinical reasoning cases and the weekly patient scenario." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudyApp view="cases" />,
});
