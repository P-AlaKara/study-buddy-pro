import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/osce/$stationId")({
  component: RetiredOsceRoute,
});

function RetiredOsceRoute() {
  return (
    <section className="clay-card mx-auto max-w-xl bg-yellow-soft p-6 text-center">
      <h1 className="text-2xl font-black">This legacy station has been retired.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The immersive history-taking room will replace this route in the UI phase.
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
