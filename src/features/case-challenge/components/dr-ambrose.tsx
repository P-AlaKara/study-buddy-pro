import { useId, type ReactNode } from "react";
import { DR_AMBROSE } from "../config.js";

export { DR_AMBROSE } from "../config.js";

export type AmbroseExpression =
  "neutral" | "thinking" | "encouraging" | "concerned" | "proud" | "surprised";

export function DrAmbrose({
  expression = "neutral",
  variant = "avatar",
  className = "",
}: {
  expression?: AmbroseExpression;
  variant?: "avatar" | "logo";
  className?: string;
}) {
  const rawId = useId();
  const id = rawId.replaceAll(":", "");
  const compact = variant === "logo";
  const eyesClosed = expression === "encouraging" || expression === "proud";

  return (
    <div
      className={`ambrose-character relative ${compact ? "aspect-square" : "aspect-[6/7]"} ${className}`}
      data-expression={expression}
      data-variant={variant}
    >
      <svg
        viewBox={compact ? "20 15 200 210" : "0 0 240 280"}
        role="img"
        aria-labelledby={`${id}-title`}
        className="h-full w-full overflow-visible drop-shadow-[0_12px_14px_rgb(34_51_65/18%)]"
      >
        <title id={`${id}-title`}>
          {DR_AMBROSE.name}, {expression}
        </title>
        <defs>
          <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#e7edf0" />
          </linearGradient>
          <linearGradient id={`${id}-backdrop`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fff8df" />
            <stop offset="1" stopColor="#cdece8" />
          </linearGradient>
        </defs>

        <path
          d="M22 77c11-47 51-69 101-65 52 4 89 38 94 90 4 48-20 102-62 125-43 24-102 11-126-33C10 160 13 115 22 77z"
          fill={`url(#${id}-backdrop)`}
        />
        <circle cx="188" cy="55" r="16" fill="#efb83e" opacity=".24" />
        <circle cx="43" cy="181" r="21" fill="#1a9aa0" opacity=".2" />

        <g className="ambrose-float">
          <path d="M42 273c2-48 22-76 58-88h42c36 12 55 40 57 88z" fill={`url(#${id}-coat)`} />
          <path d="M91 188l30 32 30-32-13-7H104z" fill="#3e7898" />
          <path d="M116 215l5 5 6-5 6 45-12 10-11-10z" fill="#d66a55" />
          <path
            d="M99 184l22 36-30 18-16-42zM143 184l-22 36 30 18 16-42z"
            fill="#fff"
            stroke="#d9e1e5"
            strokeWidth="2"
          />
          <path
            d="M72 208c-3 20 2 42 19 49"
            fill="none"
            stroke="#344c5b"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M170 208c3 20-2 42-19 49"
            fill="none"
            stroke="#344c5b"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="92" cy="257" r="7" fill="#d9e6eb" stroke="#344c5b" strokeWidth="3" />
          <circle cx="150" cy="257" r="7" fill="#d9e6eb" stroke="#344c5b" strokeWidth="3" />

          <path d="M99 158v31c8 10 36 10 44 0v-33z" fill="#c88b67" />
          <ellipse cx="72" cy="113" rx="13" ry="17" fill="#c88b67" />
          <ellipse cx="170" cy="113" rx="13" ry="17" fill="#c88b67" />
          <path
            d="M75 71c5-36 29-54 49-52 25 1 47 20 48 58l-3 56c-3 36-24 55-48 55-26 0-47-21-49-57z"
            fill="#c88b67"
          />

          <path
            d="M73 83c1-46 25-67 52-64 29 3 50 25 47 67-10-16-22-24-37-28-15 12-35 20-62 25z"
            fill="#eef0ed"
          />
          <path
            d="M80 54q43-35 82 8"
            fill="none"
            stroke="#aeb5b4"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M77 64q-7 49 1 77"
            fill="none"
            stroke="#d9ddda"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M165 62q8 47 0 78"
            fill="none"
            stroke="#d9ddda"
            strokeWidth="7"
            strokeLinecap="round"
          />

          <AmbroseBrows expression={expression} />
          {eyesClosed ? (
            <g fill="none" stroke="#303138" strokeWidth="3" strokeLinecap="round">
              <path d="M86 109q8 6 17 0" />
              <path d="M139 109q8 6 17 0" />
            </g>
          ) : expression === "surprised" ? (
            <g fill="#303138">
              <circle cx="95" cy="110" r="5" />
              <circle cx="147" cy="110" r="5" />
            </g>
          ) : (
            <g className="ambrose-eyes" fill="#303138">
              <ellipse cx="95" cy="110" rx="4" ry="5" />
              <ellipse cx="147" cy="110" rx="4" ry="5" />
            </g>
          )}

          <g fill="none" stroke="#49545c" strokeWidth="3">
            <circle cx="95" cy="110" r="15" />
            <circle cx="147" cy="110" r="15" />
            <path d="M110 108q11-5 22 0M79 106l-10-4M163 106l10-4" />
          </g>
          <path
            d="M121 109c-2 12-3 21 0 24 3 2 7 2 10-1"
            fill="none"
            stroke="#915f47"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          <path d="M88 139q11-13 27 2 7-12 17 0 16-15 26-2-4 44-35 44-31 0-35-44z" fill="#e6e9e5" />
          <path
            d="M98 139q13-9 23 2 10-11 23-2"
            fill="none"
            stroke="#aeb5b4"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <AmbroseMouth expression={expression} />
        </g>

        {expression === "thinking" && (
          <g className="ambrose-thought" fill="#fff" stroke="#d7b756" strokeWidth="2">
            <circle cx="187" cy="80" r="5" />
            <circle cx="202" cy="67" r="8" />
            <path
              d="M205 37c20 0 27 24 10 34-9 5-10 9-10 14"
              fill="#fff8df"
              strokeLinecap="round"
            />
          </g>
        )}
        {expression === "proud" && (
          <g className="ambrose-spark" fill="#f0b936">
            <path d="M188 76l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
            <path d="M55 88l2 6 6 2-6 3-2 6-3-6-6-3 6-2z" />
          </g>
        )}
        {expression === "concerned" && (
          <path d="M190 82c8 10 8 17 1 20-8-3-8-10-1-20z" fill="#51b7c9" />
        )}
      </svg>
    </div>
  );
}

function AmbroseBrows({ expression }: { expression: AmbroseExpression }) {
  const paths =
    expression === "concerned"
      ? ["M82 94q11-10 23 1", "M137 95q12-11 23-1"]
      : expression === "surprised"
        ? ["M83 91q11-7 22 0", "M138 91q11-7 22 0"]
        : expression === "thinking"
          ? ["M83 95q11-6 22 0", "M138 91q11-9 22 0"]
          : ["M83 95q11-5 22 0", "M138 95q11-5 22 0"];
  return (
    <g fill="none" stroke="#747b7d" strokeWidth="4" strokeLinecap="round">
      <path d={paths[0]} />
      <path d={paths[1]} />
    </g>
  );
}

function AmbroseMouth({ expression }: { expression: AmbroseExpression }) {
  if (expression === "surprised") {
    return <ellipse cx="123" cy="153" rx="7" ry="8" fill="#714238" />;
  }
  const path =
    expression === "concerned"
      ? "M111 158q12-8 24 0"
      : expression === "neutral" || expression === "thinking"
        ? "M112 154q11 4 22 0"
        : "M109 151q14 14 29 0";
  return <path d={path} fill="none" stroke="#714238" strokeWidth="3" strokeLinecap="round" />;
}

export function CaseMascotState({
  title,
  children,
  expression = "thinking",
  className = "",
}: {
  title: string;
  children: ReactNode;
  expression?: AmbroseExpression;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <DrAmbrose expression={expression} variant="logo" className="mx-auto w-28 max-w-full" />
      <h2 className="mt-3 text-xl font-black text-slate-800">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">
        {children}
      </div>
    </div>
  );
}
