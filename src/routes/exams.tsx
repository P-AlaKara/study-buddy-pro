import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/exams")({
  component: () => (
    <StudyApp view="exams">
      <Outlet />
    </StudyApp>
  ),
});
