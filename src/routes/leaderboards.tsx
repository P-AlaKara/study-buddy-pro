import { createFileRoute } from "@tanstack/react-router";
import { Leaderboards } from "@/components/gamification";
import { StudyApp, useActingStudent } from "@/components/study-app";

export const Route = createFileRoute("/leaderboards")({
  head: () => ({
    meta: [
      { title: "Leaderboards | Medley" },
      {
        name: "description",
        content: "Friendly weekly, monthly, case, group, university and year leaderboards.",
      },
    ],
  }),
  component: () => (
    <StudyApp view="leaderboards">
      <LeaderboardContent />
    </StudyApp>
  ),
});

function LeaderboardContent() {
  return <Leaderboards student={useActingStudent()} />;
}
