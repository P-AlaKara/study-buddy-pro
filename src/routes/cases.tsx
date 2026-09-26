import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/cases")({
  component: () => <StudyApp view="cases"><Outlet /></StudyApp>,
});
