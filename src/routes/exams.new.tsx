import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UploadPanel } from "@/features/exam-generator/upload-panel";

// `focus` arrives pre-filled when a student chooses to re-test their weak areas
// after completing an exam; it seeds the "Specific" focus on the upload screen.
const search = z.object({
  focus: z.string().max(600).optional().catch(undefined),
});

export const Route = createFileRoute("/exams/new")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "New exam | Medley" },
      { name: "description", content: "Upload your notes to generate a comprehensive exam." },
    ],
  }),
  component: NewExamPage,
});

function NewExamPage() {
  const { focus } = Route.useSearch();
  return <UploadPanel initialFocus={focus ?? null} />;
}
