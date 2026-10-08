import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/osce/exam")({
  component: RetiredExamRoute,
});

function RetiredExamRoute() {
  return (
    <section className="clay-card mx-auto max-w-xl bg-yellow-soft p-6 text-center">
      <h1 className="text-2xl font-black">The old exam circuit is no longer active.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Exam mode is being rebuilt around the new rule-based consultation engine.
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
