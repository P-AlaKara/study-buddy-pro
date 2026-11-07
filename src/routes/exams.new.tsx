import { createFileRoute } from "@tanstack/react-router";
import { UploadPanel } from "@/features/exam-generator/upload-panel";

export const Route = createFileRoute("/exams/new")({
  head: () => ({
    meta: [
      { title: "New exam | Medley" },
      { name: "description", content: "Upload your notes to generate a comprehensive exam." },
    ],
  }),
  component: UploadPanel,
});
