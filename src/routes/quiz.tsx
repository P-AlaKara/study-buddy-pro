import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/quiz")({
  component: () => <StudyApp view="practice"><Outlet /></StudyApp>,
});
