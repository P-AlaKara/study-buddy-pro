import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  HeartPulse,
  Mail,
  LockKeyhole,
  User,
  GraduationCap,
  Stethoscope,
} from "lucide-react";
import { signIn, signUp, type AccountRole } from "./auth.functions";

type Mode = "signin" | "signup";

export function AuthScreen({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AccountRole>("student");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isSignup) {
        await signUp({
          data: { email, password, displayName: displayName.trim() || undefined, role },
        });
      } else {
        await signIn({ data: { email, password } });
      }
      queryClient.clear();
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5 font-display text-[26px] font-black text-foreground">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-pink text-foreground shadow-sm">
            <HeartPulse size={23} strokeWidth={2.5} />
          </span>
          medley<span className="text-pink">.</span>
        </div>

        <div className="clay-card bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-black text-foreground">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {isSignup
              ? "Sign up once to study cases, OSCEs, flashcards and more."
              : "Sign in to pick up where you left off."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div className="space-y-1.5 text-left">
                <span className="text-sm font-extrabold text-foreground">I'm joining as a…</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "student", label: "Student", icon: GraduationCap },
                      { value: "coach", label: "USMLE coach", icon: Stethoscope },
                    ] as const
                  ).map((option) => {
                    const selected = role === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRole(option.value)}
                        aria-pressed={selected}
                        className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <option.icon className="size-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {role === "coach"
                    ? "Create classes, enroll students, and message them."
                    : "Study cases, OSCEs and flashcards, and learn from coaches."}
                </p>
              </div>
            )}

            {isSignup && (
              <Field
                id="name"
                label={role === "coach" ? "Full name" : "Display name (optional)"}
                icon={<User className="size-4 text-muted-foreground" />}
              >
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                  placeholder="How should we greet you?"
                />
              </Field>
            )}

            <Field
              id="email"
              label="Email address"
              icon={<Mail className="size-4 text-muted-foreground" />}
            >
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                placeholder="you@university.edu"
              />
            </Field>

            <Field
              id="password"
              label="Password"
              icon={<LockKeyhole className="size-4 text-muted-foreground" />}
            >
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
              />
            </Field>

            {error && (
              <p className="text-sm font-bold text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="clay-button flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-60"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link to="/login" className="font-black text-primary hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Medley?{" "}
                <Link to="/register" className="font-black text-primary hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNodeLike;
  children: ReactNodeLike;
}) {
  return (
    <div className="space-y-1.5 text-left">
      <label htmlFor={id} className="text-sm font-extrabold text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 focus-within:ring-2 focus-within:ring-primary">
        {icon}
        {children}
      </div>
    </div>
  );
}

type ReactNodeLike = React.ReactNode;
