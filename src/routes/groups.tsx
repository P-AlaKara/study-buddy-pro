import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/groups")({
  head: () => ({ meta: [
    { title: "Study groups | Medley" },
    { name: "description", content: "Study alongside your peers and discover group challenges." },
    { property: "og:title", content: "Study groups | Medley" },
    { property: "og:description", content: "Study alongside your peers and discover group challenges." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudyApp view="Groups" />,
});
