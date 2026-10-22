import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ANATOMY_LAB_ENABLED } from "@/features/anatomy-lab/feature-flag";

// Lazy-load the feature so the Three.js engine and anatomy UI stay out of the
// initial app bundle and only load when a student opens the Anatomy Lab.
const AnatomyLab = lazy(() => import("@/features/anatomy-lab/anatomy-lab"));

export const Route = createFileRoute("/anatomy")({
  beforeLoad: () => {
    if (!ANATOMY_LAB_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Anatomy Lab | Medley" },
      {
        name: "description",
        content:
          "Explore an interactive, university-level 3D human anatomy model: search structures, toggle systems, isolate and explode the body.",
      },
    ],
  }),
  component: AnatomyLabPage,
});

function AnatomyLabPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm font-extrabold text-muted-foreground">
            <Loader2 size={20} className="animate-spin text-primary" />
            Loading the Anatomy Lab…
          </div>
        </div>
      }
    >
      <AnatomyLab />
    </Suspense>
  );
}
