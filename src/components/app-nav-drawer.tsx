import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, HeartPulse, LogOut, Menu, X, type LucideIcon } from "lucide-react";

export type AppNavItem<K extends string = string> = {
  key: K;
  label: string;
  to: string;
  icon: LucideIcon;
};

// The inline header nav takes over from Tailwind's `lg` breakpoint upwards.
const DESKTOP_NAV_QUERY = "(min-width: 1024px)";

/**
 * Below `lg` the main navigation lives in a slide-in drawer opened from the
 * hamburger button at the left of the top bar (replaces the old bottom tab bar).
 * Radix Dialog gives us focus trapping, Esc/scrim to close, scroll locking and
 * focus return to the trigger.
 */
export function AppNavDrawer<K extends string>({
  items,
  active,
  account,
  onSignOut,
}: {
  items: AppNavItem<K>[];
  active: string;
  account: { name?: string | undefined; initials: string };
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // If the viewport grows past the breakpoint while the drawer is open (tablet
  // rotation, window resize) the trigger disappears, so close the drawer too.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP_NAV_QUERY);
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="clay-button flex size-11 shrink-0 items-center justify-center bg-card lg:hidden"
        >
          <Menu size={20} strokeWidth={2.4} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(84vw,20rem)] flex-col rounded-r-[28px] bg-card pl-[env(safe-area-inset-left)] shadow-2xl outline-none duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-200"
        >
          <Dialog.Title className="sr-only">Main menu</Dialog.Title>
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <Link
              to="/"
              onClick={close}
              className="flex items-center gap-2.5 font-display text-2xl font-black text-foreground"
              aria-label="Medley home"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-pink shadow-sm">
                <HeartPulse size={23} strokeWidth={2.5} />
              </span>
              <span>
                medley<span className="text-pink">.</span>
              </span>
            </Link>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close menu"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </Dialog.Close>
          </div>

          <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-2">
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === active;
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      onClick={close}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-[15px] font-extrabold transition-colors active:scale-[0.98] ${isActive ? "bg-lavender-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-card text-foreground shadow-sm" : "bg-muted/70"}`}
                      >
                        <Icon size={19} strokeWidth={isActive ? 2.5 : 2.1} />
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-border/70 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <Link
              to="/profile"
              onClick={close}
              aria-current={active === "profile" ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl p-2 transition-colors ${active === "profile" ? "bg-lavender-soft" : "hover:bg-muted"}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-black">
                {account.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">
                  {account.name ?? "Your account"}
                </span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  View profile
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() => {
                close();
                onSignOut();
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-extrabold text-red-600 transition-colors hover:bg-muted"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
