import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { OsceScreen } from "@/features/osce/components/osce-screen";
import { OSCE_STATIONS } from "@/features/osce/stations";

export const Route = createFileRoute("/osce/$stationId")({
  validateSearch: z.object({
    mode: z.enum(["learn", "practice", "exam"]).catch("learn"),
  }),
  head: () => ({
    meta: [
      { title: "OSCE consultation | Medley" },
      {
        name: "description",
        content: "Conduct a rule-based history-taking consultation with an animated patient.",
      },
    ],
  }),
  component: OsceStationRoute,
});

function OsceStationRoute() {
  const { stationId } = Route.useParams();
  const { mode } = Route.useSearch();
  const station = OSCE_STATIONS.find((candidate) => candidate.id === stationId);

  if (station) return <OsceScreen key={`${station.id}:${mode}`} station={station} mode={mode} />;

  return (
    <section className="clay-card mx-auto max-w-xl bg-yellow-soft p-6 text-center">
      <h1 className="text-2xl font-black">Station not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This OSCE station is not in the current bank.
      </p>
      <Link
        to="/osce"
        className="clay-button mt-5 inline-flex bg-pink px-5 py-2.5 text-sm font-extrabold text-primary-foreground"
      >
        Back to OSCE
      </Link>
    </section>
  );
}
