import { createFileRoute } from "@tanstack/react-router";
import { ExamHome } from "@/features/exam-generator/exam-home";

export const Route = createFileRoute("/exams/")({
  head: () => ({
    meta: [
      { title: "Exam Generator | Medley" },
      {
        name: "description",
        content:
          "Turn your lecture notes into comprehensive, source-grounded exams and flashcards.",
      },
      { property: "og:title", content: "Exam Generator | Medley" },
      {
        property: "og:description",
        content: "Upload PDFs and slides, get a comprehensive exam, and study at your own pace.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ExamHome,
});
