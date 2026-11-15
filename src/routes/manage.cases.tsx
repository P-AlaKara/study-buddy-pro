import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { StudyApp } from "@/components/study-app";
import { CaseStudioScreen } from "@/features/case-studio/components/case-studio-screen";
import { getCaseStudioAccess } from "@/features/case-studio/access.functions";

/**
 * Content-creator workspace for the clinical case bank. The root route already
 * requires a signed-in account; this guard additionally asks the server whether
 * that account is on the content-creator allowlist (CONTENT_CREATOR_EMAILS).
 * Everyone else sees a restricted notice instead of the studio.
 */
export const Route = createFileRoute("/manage/cases")({
  beforeLoad: async () => {
    let canManageCases = false;
    try {
      canManageCases = (await getCaseStudioAccess()).allowed;
    } catch {
      canManageCases = false;
    }
    return { canManageCases };
  },
  head: () => ({
    meta: [
      { title: "Manage cases | Medley" },
      {
        name: "description",
        content: "Validate the clinical case bank and build new cases.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManageCasesPage,
});

function ManageCasesPage() {
  const { canManageCases } = Route.useRouteContext();
  return (
    <StudyApp view="manage">
      {canManageCases ? <CaseStudioScreen /> : <RestrictedNotice />}
    </StudyApp>
  );
}

function RestrictedNotice() {
  return (
    <section className="clay-card mx-auto max-w-lg bg-card p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-pink-soft">
        <Lock className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-black">Content creators only</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The case studio is limited to accounts on the content-creator list. If you write cases for
        Medley, ask an administrator to add your sign-in email.
      </p>
      <Link
        to="/cases"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#168d91] px-5 py-3 text-sm font-black text-white"
      >
        <ArrowLeft className="size-4" /> Back to cases
      </Link>
    </section>
  );
}
