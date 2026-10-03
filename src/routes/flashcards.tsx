import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/flashcards")({
  component: () => <StudyApp view="practice"><Outlet /></StudyApp>,
});
