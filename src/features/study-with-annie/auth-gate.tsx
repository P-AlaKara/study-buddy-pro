import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AnnieAuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center" role="status">
        <LoaderCircle className="size-7 animate-spin text-[#6d5fb1]" aria-hidden="true" />
        <span className="sr-only">Checking your account</span>
      </div>
    );
  }
  if (user) return <>{children(user)}</>;

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setMessage(error ? error.message : "Check your inbox for a secure sign-in link.");
    setSending(false);
  }

  return (
    <section className="mx-auto grid min-h-[70dvh] max-w-5xl place-items-center px-4 py-12">
      <div className="clay-card w-full max-w-lg bg-white p-6 text-center sm:p-9">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#eeeafd] text-[#6d5fb1] shadow-sm">
          <LockKeyhole className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.17em] text-[#6d5fb1]">
          Your notes stay private
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Sign in to study with Annie</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">
          We’ll email a secure link. Your PDFs and annotations are available only to your account.
        </p>
        <form onSubmit={sendMagicLink} className="mt-7 space-y-3 text-left">
          <label htmlFor="annie-email" className="text-sm font-extrabold text-slate-700">
            Email address
          </label>
          <div className="flex items-center gap-2 rounded-2xl bg-[#f7f5ef] px-4 focus-within:ring-2 focus-within:ring-[#7566b7]">
            <Mail className="size-4 text-slate-400" aria-hidden="true" />
            <input
              id="annie-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
              placeholder="you@university.edu"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="clay-button flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7566b7] px-5 text-sm font-black text-white disabled:opacity-60"
          >
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Email me a sign-in link
          </button>
        </form>
        {message && (
          <p className="mt-4 text-sm font-bold text-slate-600" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
