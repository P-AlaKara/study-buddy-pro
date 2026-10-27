import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/auth-screen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | Medley" },
      { name: "description", content: "Sign in to your Medley study space." },
    ],
  }),
  component: () => <AuthScreen mode="signin" />,
});
