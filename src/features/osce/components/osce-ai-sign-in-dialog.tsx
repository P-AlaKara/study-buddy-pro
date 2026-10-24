import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function OsceAiSignInDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Keep the latest props in refs so the auth subscription below can be created
  // once (stable, empty deps). The parent passes fresh inline callbacks every
  // render; depending on them here would re-subscribe on every render, and each
  // re-subscription replays the current session, which — when already signed in
  // — re-fires onAuthenticated in a tight loop (the screen flickers).
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const onAuthenticatedRef = useRef(onAuthenticated);
  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;
  onAuthenticatedRef.current = onAuthenticated;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Only act on a real sign-in completed from this dialog while it is open.
      // Ignore INITIAL_SESSION / token refreshes replayed to the listener.
      if (event !== "SIGNED_IN" || !session?.user || !openRef.current) return;
      onOpenChangeRef.current(false);
      onAuthenticatedRef.current();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSent(true);
    setMessage("Check your email for a sign-in code or secure link.");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="clay-card max-w-md border-0 bg-card p-6 sm:rounded-[28px]">
        <DialogHeader>
          <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-lavender-soft text-lavender">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-2xl font-black">Sign in for Free-form</DialogTitle>
          <DialogDescription className="font-semibold leading-relaxed">
            Guided practice stays available without an account. Sign in so the AI can securely keep
            this consultation’s history and assessment evidence.
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label htmlFor="osce-ai-email" className="text-sm font-black">
              Email address
            </label>
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 focus-within:ring-2 focus-within:ring-lavender">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <input
                id="osce-ai-email"
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
              disabled={busy}
              className="clay-button flex h-12 w-full items-center justify-center gap-2 bg-lavender px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Send secure sign-in
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <label htmlFor="osce-ai-code" className="text-sm font-black">
              Email code
            </label>
            <input
              id="osce-ai-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="h-12 w-full rounded-2xl bg-muted px-4 text-center font-mono text-lg font-black tracking-[0.3em] outline-none focus:ring-2 focus:ring-lavender"
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={busy || !otp.trim()}
              className="clay-button flex h-12 w-full items-center justify-center gap-2 bg-lavender px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Verify and continue
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setOtp("");
                setMessage("");
              }}
              className="w-full text-center text-xs font-black text-muted-foreground"
            >
              Use a different email
            </button>
          </form>
        )}
        {message && (
          <p className="rounded-2xl bg-blue-soft p-3 text-sm font-bold" role="status">
            {message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
