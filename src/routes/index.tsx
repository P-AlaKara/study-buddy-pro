import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";
import { LandingPage } from "@/features/marketing/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medley | Study medicine the way you'll practise it" },
      {
        name: "description",
        content:
          "Cases, OSCEs, quizzes, flashcards, your own notes and USMLE coaching — one joyful study space for medical students.",
      },
      { property: "og:title", content: "Medley | Study medicine the way you'll practise it" },
      {
        property: "og:description",
        content:
          "Cases, OSCEs, quizzes, flashcards, your own notes and USMLE coaching — one joyful study space for medical students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeRoute,
});

// Signed-out visitors get the marketing landing page; signed-in students and
// coaches get their study space. The root guard keeps "/" reachable for both.
function HomeRoute() {
  const { user } = Route.useRouteContext();
  return user ? <StudyApp view="home" /> : <LandingPage />;
}
