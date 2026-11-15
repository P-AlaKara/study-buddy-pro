import { useId, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, X, XCircle } from "lucide-react";
import type { StudioIssue } from "../drafts";

/* Small, consistent building blocks for the case studio forms and panels. */

const CONTROL =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground/70 focus:border-[#168d91] focus:ring-2 focus:ring-[#168d91]/30 disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
  disabled = false,
  list,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  list?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      list={list}
      onChange={(event) => onChange(event.target.value)}
      className={`${CONTROL} ${mono ? "font-mono text-xs" : ""}`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`${CONTROL} resize-y leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
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
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      step={step}
      min={min}
      max={max}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          onChange(allowEmpty ? undefined : 0);
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      className={CONTROL}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={CONTROL}
    >
      {placeholder && (
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

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-sm font-bold hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-[#168d91]"
      />
      <span>
        {label}
        {hint && <span className="block text-xs font-medium text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Free-text tags (specialties, presenting features): Enter or comma adds one. */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: readonly string[];
}) {
  const [text, setText] = useState("");
  const listId = useId();
  function commit() {
    const next = text.trim().replace(/,$/, "").trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setText("");
  }
  return (
    <div className={`${CONTROL} flex flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-lavender-soft px-2.5 py-1 text-xs font-extrabold"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="rounded-full hover:bg-card"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        list={suggestions.length ? listId : undefined}
        placeholder={value.length ? "" : placeholder}
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
        className="min-w-[8rem] flex-1 bg-transparent text-sm font-semibold outline-none"
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

/** Pick several ids from a fixed set (differential ids, treatment ids…). */
export function ChipSelect({
  options,
  value,
  onChange,
  emptyLabel = "Nothing to choose from yet.",
}: {
  options: readonly { id: string; label: string }[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
}) {
  if (!options.length) {
    return <p className="text-xs font-medium text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(active ? value.filter((id) => id !== option.id) : [...value, option.id])
            }
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${active ? "bg-[#168d91] text-white" : "bg-muted text-foreground hover:bg-lavender-soft"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent" | "info";
}) {
  const tones = {
    neutral: "bg-muted text-foreground",
    good: "bg-mint-soft text-[#0d686d]",
    warn: "bg-yellow-soft text-[#7a5a00]",
    bad: "bg-pink-soft text-[#9b2c2c]",
    accent: "bg-lavender-soft text-[#5b50a3]",
    info: "bg-blue-soft text-[#1f4e8c]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  badge,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="clay-card bg-card">
      <div className="flex items-start gap-3 p-4 md:p-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <ChevronDown
            className={`mt-1 size-5 shrink-0 text-ink-soft transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-black">{title}</span>
              {badge}
            </span>
            {description && (
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            )}
          </span>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {open && <div className="border-t border-border px-4 pb-5 pt-4 md:px-5">{children}</div>}
    </section>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-lavender-soft px-3.5 py-2 text-xs font-black text-[#5b50a3] transition-colors hover:bg-lavender"
    >
      <Plus className="size-4" /> {children}
    </button>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-pink-soft hover:text-[#9b2c2c]"
    >
      <X className="size-4" />
    </button>
  );
}

export function IssueList({
  issues,
  compact = false,
}: {
  issues: StudioIssue[];
  compact?: boolean;
}) {
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3 py-2 text-sm font-bold text-[#0d686d]">
        <CheckCircle2 className="size-4" /> Passes every check.
      </p>
    );
  }
  return (
    <ul className={`space-y-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      {issues.map((issue, index) => (
        <li
          key={`${issue.path}-${index}`}
          className={`flex items-start gap-2 rounded-2xl px-3 py-2 ${issue.severity === "error" ? "bg-pink-soft text-[#7b1f1f]" : "bg-yellow-soft text-[#5c4300]"}`}
        >
          {issue.severity === "error" ? (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block break-all font-mono text-[11px] font-bold opacity-80">
              {issue.path}
            </span>
            <span className="block font-semibold">{issue.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-card",
    good: "bg-mint-soft",
    warn: "bg-yellow-soft",
    bad: "bg-pink-soft",
  };
  return (
    <div className={`clay-card p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function ToolButton({
  onClick,
  children,
  tone = "default",
  disabled = false,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const tones = {
    default: "bg-card text-foreground hover:bg-muted",
    primary: "bg-[#168d91] text-white hover:bg-[#107b80]",
    danger: "bg-card text-[#9b2c2c] hover:bg-pink-soft",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
