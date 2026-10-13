import { Link } from "@tanstack/react-router";
import { BookOpenText, HeartPulse, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AnnieShell({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f8f5ee] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-[#e7e1d7] bg-[#f8f5ee]/95 backdrop-blur">
        <div className="mx-auto flex w-[min(100%-2rem,1440px)] items-center justify-between gap-3 py-3 sm:py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display text-xl font-black sm:text-2xl"
            aria-label="Medley home"
          >
            <span className="grid size-9 place-items-center rounded-2xl bg-pink text-foreground shadow-sm">
              <HeartPulse size={20} strokeWidth={2.5} />
            </span>
            <span className={compact ? "hidden sm:inline" : ""}>
              medley<span className="text-pink">.</span>
            </span>
          </Link>
          <Link
            to="/study-with-annie"
            className="flex min-w-0 items-center gap-2 rounded-full bg-[#eeeafd] px-3 py-2 text-sm font-black text-[#574a98] sm:px-4"
          >
            <BookOpenText className="size-4 shrink-0" />
            <span className="truncate">Study with Annie</span>
          </Link>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-slate-500 hover:bg-white hover:text-slate-900"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
