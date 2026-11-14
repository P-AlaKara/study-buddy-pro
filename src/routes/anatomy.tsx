import { createFileRoute, redirect } from "@tanstack/react-router";

// The Anatomy Lab moved under Labs; keep old links and bookmarks working.
export const Route = createFileRoute("/anatomy")({
  beforeLoad: () => {
    throw redirect({ to: "/labs/anatomy", replace: true });
  },
});
