import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the case studio. Labels are sentence case and help text
 * is always visible (never hover-only); every control is keyboard reachable
 * with a visible focus ring; status is always icon + words, never colour alone.
 */

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c63e0] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const CONTROL =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px] font-semibold text-foreground shadow-[inset_0_1px_2px_rgb(30_20_60/0.05)] outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/80 focus:border-[#7c63e0] focus:ring-2 focus:ring-[#7c63e0]/25 disabled:opacity-60";

/* ---- Fields --------------------------------------------------------------- */

const FieldContext = createContext<{ id: string; describedBy?: string } | null>(null);

function useFieldIds() {
  return useContext(FieldContext);
}

export function Field({
  label,
  required = false,
  help,
  example,
  anchor,
  group = false,
  className,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  help?: ReactNode | undefined;
  example?: string | undefined;
  /** DOM id the studio scrolls to when a check points here. */
  anchor?: string | undefined;
  /** Use for chip groups and other composite controls (renders a fieldset). */
  group?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const hasHelp = Boolean(help || example);
  const heading = (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-sm font-extrabold text-foreground">{label}</span>
      <span
        className={cn(
          "text-[11px] font-bold",
          required ? "text-[#8a3b12]" : "text-muted-foreground",
        )}
      >
        {required ? "Required" : "Optional"}
      </span>
    </span>
  );
  const helpBlock = hasHelp ? (
    <span id={helpId} className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
      {help}
      {example && (
        <>
          {help ? " " : ""}
          <span className="text-ink-soft">e.g. “{example}”</span>
        </>
      )}
    </span>
  ) : null;

  if (group) {
    return (
      <fieldset
        id={anchor}
        aria-describedby={hasHelp ? helpId : undefined}
        className={cn("studio-anchor min-w-0 scroll-mt-28", className)}
      >
        <legend className="mb-2 block w-full">
          {heading}
          {helpBlock}
        </legend>
        {children}
      </fieldset>
    );
  }
  return (
    <FieldContext.Provider value={{ id, ...(hasHelp ? { describedBy: helpId } : {}) }}>
      <div id={anchor} className={cn("studio-anchor min-w-0 scroll-mt-28", className)}>
        <label htmlFor={id} className="mb-1.5 block">
          {heading}
          {helpBlock}
        </label>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  ariaLabel,
  list,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean;
  className?: string | undefined;
  ariaLabel?: string | undefined;
  list?: string | undefined;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  const field = useFieldIds();
  return (
    <input
      type="text"
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      list={list}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL, className)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  ariaLabel,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  rows?: number;
  className?: string | undefined;
  ariaLabel?: string | undefined;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const field = useFieldIds();
  return (
    <textarea
      ref={textareaRef}
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-label={ariaLabel}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL, "resize-y leading-relaxed", className)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  allowEmpty = false,
  suffix,
  ariaLabel,
  className,
  placeholder,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  suffix?: string | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  placeholder?: string | undefined;
}) {
  const field = useFieldIds();
  return (
    <span className={cn("relative block", className)}>
      <input
        type="number"
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-label={ariaLabel}
        value={value ?? ""}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        inputMode={step < 1 ? "decimal" : "numeric"}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(allowEmpty ? undefined : 0);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className={cn(CONTROL, suffix ? "pr-12" : "")}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-muted-foreground">
          {suffix}
        </span>
      )}
    </span>
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
}) {
  const field = useFieldIds();
  return (
    <select
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(CONTROL, "cursor-pointer pr-8", className)}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** A labelled on/off switch with an explanation of what "on" means. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
  tone = "default",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  tone?: "default" | "danger" | "good" | "warn";
}) {
  const id = useId();
  const tones = {
    default: "bg-lavender-soft/70 border-[#c9bdf2]",
    danger: "bg-pink-soft border-[#f0b8b8]",
    good: "bg-mint-soft border-[#a9dcc6]",
    warn: "bg-yellow-soft border-[#ead79a]",
  };
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
        checked ? tones[tone] : "border-border bg-card hover:bg-muted/60",
      )}
    >
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={cn("peer sr-only")}
        />
        <span
          aria-hidden
          className={cn(
            "h-6 w-10 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#7c63e0] peer-focus-visible:ring-offset-2",
            checked ? "bg-[#5a44b5]" : "bg-[#cfcadb]",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-extrabold">
          {icon}
          {label}
          <span className="sr-only">{checked ? "(on)" : "(off)"}</span>
        </span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/** Radio cards: one choice with a description each. */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  name,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; description?: string; icon?: ReactNode }[];
  columns?: 1 | 2 | 3;
  name?: string;
}) {
  const fallback = useId();
  const group = name ?? fallback;
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7c63e0]",
              active
                ? "border-[#7c63e0] bg-lavender-soft"
                : "border-border bg-card hover:bg-muted/60",
            )}
          >
            <input
              type="radio"
              name={group}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 shrink-0 accent-[#5a44b5]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                {option.icon}
                {option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Pick several items from a list (diagnoses, actions…). */
export function ChipToggleGroup({
  options,
  value,
  onChange,
  emptyLabel = "Nothing to choose from yet.",
  label,
}: {
  options: readonly { id: string; label: string; hint?: string }[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string | undefined;
  label?: string | undefined;
}) {
  if (!options.length) {
    return <p className="text-[13px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const active = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            title={option.hint}
            onClick={() =>
              onChange(active ? value.filter((id) => id !== option.id) : [...value, option.id])
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors",
              FOCUS_RING,
              active
                ? "border-[#5a44b5] bg-[#5a44b5] text-white"
                : "border-border bg-card text-foreground hover:bg-lavender-soft",
            )}
          >
            {active && <CheckCircle2 aria-hidden className="size-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text tags: Enter or comma adds one. */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  placeholder?: string | undefined;
  suggestions?: readonly string[];
}) {
  const field = useFieldIds();
  const [text, setText] = useState("");
  const listId = useId();
  function commit() {
    const next = text.trim().replace(/,$/, "").trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setText("");
  }
  return (
    <div className={cn(CONTROL, "flex flex-wrap items-center gap-1.5 py-1.5")}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-lavender-soft px-2.5 py-1 text-[13px] font-bold"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className={cn("rounded-full p-0.5 hover:bg-card", FOCUS_RING)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        id={field?.id}
        aria-describedby={field?.describedBy}
        value={text}
        list={suggestions.length ? listId : undefined}
        placeholder={value.length ? "Add another…" : placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="min-w-[9rem] flex-1 bg-transparent py-1 text-[15px] font-semibold outline-none"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/* ---- Buttons --------------------------------------------------------------- */

type ButtonTone = "primary" | "secondary" | "ghost" | "danger" | "quiet";

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: "bg-[#5a44b5] text-white shadow-[0_6px_14px_-6px_rgb(90_68_181/0.6)] hover:bg-[#4a3799]",
  secondary: "bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-card text-[#9b2c2c] ring-1 ring-[#f0c6c6] hover:bg-pink-soft",
  quiet: "bg-lavender-soft text-[#4a3799] hover:bg-[#e3dbf7]",
};

export function Button({
  tone = "secondary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; size?: "sm" | "md" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-sm",
        BUTTON_TONES[tone],
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---- Status ---------------------------------------------------------------- */

export type Tone = "neutral" | "good" | "warn" | "bad" | "accent" | "info" | "dark";

const TAG_TONES: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  good: "bg-mint-soft text-[#0b5f5c]",
  warn: "bg-yellow-soft text-[#6b4f00]",
  bad: "bg-pink-soft text-[#8f2424]",
  accent: "bg-lavender-soft text-[#4a3799]",
  info: "bg-blue-soft text-[#1d4a85]",
  dark: "bg-[#2b2540] text-white",
};

export function Tag({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  title?: string | undefined;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold leading-none",
        TAG_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export type Visibility = "students" | "debrief" | "reviewers";

const VISIBILITY_META: Record<Visibility, { label: string; icon: ReactNode; tone: Tone }> = {
  students: {
    label: "Students see this",
    icon: <Eye aria-hidden className="size-3.5" />,
    tone: "info",
  },
  debrief: {
    label: "Shown in the debrief",
    icon: <GraduationCap aria-hidden className="size-3.5" />,
    tone: "accent",
  },
  reviewers: {
    label: "Hidden from students",
    icon: <EyeOff aria-hidden className="size-3.5" />,
    tone: "neutral",
  },
};

export function VisibilityTag({ visibility }: { visibility: Visibility }) {
  const meta = VISIBILITY_META[visibility];
  return (
    <Tag tone={meta.tone} icon={meta.icon} className="font-bold">
      {meta.label}
    </Tag>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warn" | "bad" | "good";
  title?: ReactNode | undefined;
  children?: ReactNode;
  action?: ReactNode;
  className?: string | undefined;
}) {
  const meta = {
    info: { box: "bg-blue-soft text-[#173f72]", icon: <Info className="size-5" /> },
    warn: { box: "bg-yellow-soft text-[#5c4300]", icon: <AlertTriangle className="size-5" /> },
    bad: { box: "bg-pink-soft text-[#7b1f1f]", icon: <XCircle className="size-5" /> },
    good: { box: "bg-mint-soft text-[#0b5450]", icon: <CheckCircle2 className="size-5" /> },
  }[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl p-4", meta.box, className)}>
      <span aria-hidden className="mt-0.5 shrink-0">
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-extrabold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ---- Layout ----------------------------------------------------------------- */

export function Panel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string | undefined;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "studio-anchor scroll-mt-28 rounded-[24px] bg-card p-4 shadow-[0_10px_22px_-14px_rgb(60_45_110/0.28),inset_0_2px_1px_rgb(255_255_255/0.85)] ring-1 ring-border/60 md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeading({
  title,
  description,
  aside,
  level = 2,
}: {
  title: ReactNode;
  description?: ReactNode | undefined;
  aside?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-[min(100%,17rem)] flex-1">
        <Heading
          className={cn(
            "font-display font-black leading-tight",
            level === 2 ? "text-xl md:text-2xl" : "text-lg",
          )}
        >
          {title}
        </Heading>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}

/** A collapsible block inside a card, with a one-line summary when closed. */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  icon,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode | undefined;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  icon?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = controlledOpen ?? innerOpen;
  const contentId = useId();
  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          setInnerOpen(!open);
          onOpenChange?.(!open);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-muted/50",
          FOCUS_RING,
        )}
      >
        {icon && <span className="shrink-0 text-ink-soft">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">{title}</span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-5 shrink-0 text-ink-soft transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open && (
        <div id={contentId} className="border-t border-border px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode | undefined;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 px-5 py-8 text-center">
      {icon && (
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-card text-[#5a44b5] shadow-sm">
          {icon}
        </span>
      )}
      <p className="font-display text-lg font-black">{title}</p>
      {children && (
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function SubHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-[13px] font-black uppercase tracking-[0.08em] text-ink-soft">
        {children}
      </h4>
      {aside}
    </div>
  );
}

/* ---- Confirmation ------------------------------------------------------------ */

interface ConfirmOptions {
  title: string;
  description?: ReactNode | undefined;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-black">
              {options?.title}
            </AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription asChild>
                <div className="text-sm leading-relaxed text-muted-foreground">
                  {options.description}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full font-extrabold"
              onClick={() => settle(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "rounded-full font-extrabold text-white",
                options?.tone === "primary"
                  ? "bg-[#5a44b5] hover:bg-[#4a3799]"
                  : "bg-[#b42323] hover:bg-[#931c1c]",
              )}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
