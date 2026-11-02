import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/usmle")({
  component: () => (
    <StudyApp view="usmle">
      <Outlet />
    </StudyApp>
  ),
});
