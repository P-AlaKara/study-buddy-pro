import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/auth-screen";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account | Medley" },
      { name: "description", content: "Create your Medley account to start studying." },
    ],
  }),
  component: () => <AuthScreen mode="signup" />,
});
