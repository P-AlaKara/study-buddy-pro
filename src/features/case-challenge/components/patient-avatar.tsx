import { useId, type CSSProperties } from "react";
import type { CasePatient, PatientExpression } from "../schema.js";

const skinTones: Record<string, { base: string; shade: string; blush: string }> = {
  deep_brown: { base: "#70422f", shade: "#512d24", blush: "#a96052" },
  medium_brown: { base: "#a96d4c", shade: "#75442f", blush: "#d28775" },
  light_brown: { base: "#c88b67", shade: "#925f43", blush: "#e49a8a" },
  fair: { base: "#efbd9f", shade: "#c9896e", blush: "#ef9b91" },
};

const expressionLabels: Record<PatientExpression, string> = {
  neutral: "neutral",
  in_pain: "in pain",
  anxious: "anxious",
  struggling_to_breathe: "struggling to breathe",
  drowsy: "drowsy",
  relieved: "relieved",
};

export function PatientAvatar({
  patient,
  expression,
  respiratoryRate,
  decorative = false,
  className = "",
}: {
  patient: CasePatient;
  expression: PatientExpression;
  respiratoryRate: number;
  decorative?: boolean;
  className?: string;
}) {
  const rawId = useId();
  const id = rawId.replaceAll(":", "");
  const skin = skinTones[patient.avatar.skinTone] ?? skinTones["medium_brown"]!;
  const greyHair = patient.avatar.hair.includes("grey");
  const hair = greyHair ? "#747b82" : "#231f26";
  const hairHighlight = greyHair ? "#aeb4b8" : "#443440";
  const outfit = patient.avatar.outfit.includes("teal") ? "#168d91" : "#a94f3d";
  const outfitShade = patient.avatar.outfit.includes("teal") ? "#0d686d" : "#79372e";
  const broadShoulders = patient.sex.toLowerCase().startsWith("m");
  const breathDuration = Math.min(4.2, Math.max(1.2, 60 / Math.max(respiratoryRate, 1)));
  const title = `${patient.name}, appearing ${expressionLabels[expression]}`;
  const eyesClosed = expression === "drowsy" || expression === "in_pain";

  return (
    <div
      className={`patient-avatar relative mx-auto aspect-[6/7] w-full max-w-48 ${className}`}
      data-expression={expression}
      aria-hidden={decorative || undefined}
    >
      <svg
        viewBox="0 0 240 280"
        role={decorative ? "presentation" : "img"}
        aria-labelledby={decorative ? undefined : `${id}-title`}
        className="h-full w-full overflow-visible drop-shadow-[0_18px_18px_rgb(17_76_81/18%)]"
      >
        {!decorative && <title id={`${id}-title`}>{title}</title>}
        <defs>
          <linearGradient id={`${id}-backdrop`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffffff" stopOpacity=".92" />
            <stop offset="1" stopColor="#cdece8" stopOpacity=".82" />
          </linearGradient>
          <linearGradient id={`${id}-shirt`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor={outfit} />
            <stop offset="1" stopColor={outfitShade} />
          </linearGradient>
          <filter id={`${id}-soft-shadow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#17474d" floodOpacity=".18" />
          </filter>
        </defs>

        <rect x="6" y="6" width="228" height="268" rx="76" fill={`url(#${id}-backdrop)`} />
        <circle cx="38" cy="54" r="16" fill="#6bc8c4" opacity=".2" />
        <circle cx="207" cy="77" r="24" fill="#f3c866" opacity=".2" />

        <g
          className="patient-breathe"
          style={{ animationDuration: `${breathDuration}s` } as CSSProperties}
        >
          <path
            d={
              broadShoulders
                ? "M25 271c3-46 24-76 63-88 12-4 20-6 32-6s22 2 34 6c39 12 58 42 61 88z"
                : "M37 271c2-46 20-76 53-88 11-4 18-6 30-6s21 2 31 6c33 12 50 42 52 88z"
            }
            fill={`url(#${id}-shirt)`}
            filter={`url(#${id}-soft-shadow)`}
          />
          <path
            d="M82 190c10 17 23 25 38 25s29-8 39-25"
            fill="none"
            stroke="#fff"
            strokeOpacity=".22"
            strokeWidth="4"
          />
          <path d="M120 215v56" stroke="#fff" strokeOpacity=".15" strokeWidth="3" />
        </g>

        <path d="M96 165v31c8 10 39 10 48 0v-33z" fill={skin.base} />
        <path d="M97 176c13 8 34 7 47-4v-12H97z" fill={skin.shade} opacity=".25" />

        <ellipse cx="67" cy="119" rx="14" ry="18" fill={skin.base} />
        <ellipse cx="173" cy="119" rx="14" ry="18" fill={skin.base} />
        <path
          d="M65 119q7-8 12 0"
          fill="none"
          stroke={skin.shade}
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".55"
        />
        <path
          d="M175 119q-7-8-12 0"
          fill="none"
          stroke={skin.shade}
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".55"
        />

        <path
          d="M72 74c4-42 91-48 99 5l-2 55c-4 39-26 58-49 58-25 0-48-21-50-59z"
          fill={skin.base}
          filter={`url(#${id}-soft-shadow)`}
        />
        <path
          d="M118 112c-2 13-4 23-1 27 3 3 8 3 12 0"
          fill="none"
          stroke={skin.shade}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity=".65"
        />
        <ellipse
          cx="91"
          cy="139"
          rx="11"
          ry="6"
          fill={skin.blush}
          opacity={expression === "relieved" ? ".28" : ".16"}
        />
        <ellipse
          cx="151"
          cy="139"
          rx="11"
          ry="6"
          fill={skin.blush}
          opacity={expression === "relieved" ? ".28" : ".16"}
        />

        <Hair styleName={patient.avatar.hair} color={hair} highlight={hairHighlight} />

        <Eyebrows expression={expression} color={hair} />
        {eyesClosed ? (
          <g fill="none" stroke="#29232a" strokeWidth="3" strokeLinecap="round">
            <path d={expression === "in_pain" ? "M82 116q9-8 19 0" : "M82 116q9 5 19 0"} />
            <path d={expression === "in_pain" ? "M139 116q9-8 19 0" : "M139 116q9 5 19 0"} />
          </g>
        ) : (
          <g className="patient-eyes">
            <ellipse className="patient-eye" cx="92" cy="116" rx="5" ry="6" fill="#29232a" />
            <ellipse className="patient-eye" cx="149" cy="116" rx="5" ry="6" fill="#29232a" />
            <circle cx="94" cy="114" r="1.5" fill="white" opacity=".9" />
            <circle cx="151" cy="114" r="1.5" fill="white" opacity=".9" />
          </g>
        )}

        <Mouth expression={expression} shade={skin.shade} />
        {patient.avatar.ageCues !== "young_adult" && (
          <g fill="none" stroke={skin.shade} strokeWidth="1.5" strokeLinecap="round" opacity=".34">
            <path d="M78 126q9 4 18 1" />
            <path d="M144 127q9 3 18-1" />
            <path d="M102 154q18 8 37 0" />
          </g>
        )}

        {(expression === "anxious" || expression === "struggling_to_breathe") && (
          <g className="patient-distress-cues" fill="none" stroke="#2b9eb3" strokeLinecap="round">
            <path
              d="M177 95c8 10 8 17 1 20-8-3-8-10-1-20z"
              fill="#63c6d5"
              stroke="none"
              opacity=".9"
            />
            {expression === "struggling_to_breathe" && (
              <>
                <path d="M190 132q13 4 19 13" strokeWidth="3" />
                <path d="M188 143q11 6 15 15" strokeWidth="2" opacity=".65" />
              </>
            )}
          </g>
        )}
      </svg>
      {!decorative && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
          {expressionLabels[expression]}
        </span>
      )}
    </div>
  );
}

function Hair({
  styleName,
  color,
  highlight,
}: {
  styleName: string;
  color: string;
  highlight: string;
}) {
  const braided = styleName.includes("braid");
  const short = styleName.includes("short");

  return (
    <g>
      {braided && (
        <>
          <circle cx="151" cy="57" r="25" fill={color} />
          <path
            d="M136 42q15-13 31 0M139 52q14-12 28 0"
            fill="none"
            stroke={highlight}
            strokeWidth="3"
            opacity=".6"
          />
        </>
      )}
      <path
        d={
          short
            ? "M72 96c-3-36 17-55 49-55 29 0 49 19 50 50-15-14-32-21-51-21-18 0-34 8-48 26z"
            : "M71 100c-6-42 14-63 49-63 37 0 57 25 51 66-7-18-15-28-26-34-25 11-48 14-74 31z"
        }
        fill={color}
      />
      <path
        d="M82 72q37-28 77 2"
        fill="none"
        stroke={highlight}
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".55"
      />
      {braided && (
        <g fill="none" stroke={highlight} strokeWidth="2" opacity=".48">
          <path d="M88 62l13 20M103 52l13 24M120 48l12 23M137 51l10 19" />
        </g>
      )}
    </g>
  );
}

function Eyebrows({ expression, color }: { expression: PatientExpression; color: string }) {
  const paths =
    expression === "in_pain"
      ? ["M80 103q10-9 22-4", "M138 99q12-5 22 4"]
      : expression === "anxious" || expression === "struggling_to_breathe"
        ? ["M80 100q11-9 22 1", "M138 101q11-10 22-1"]
        : expression === "drowsy"
          ? ["M80 105q11-2 22 1", "M138 106q11-3 22-1"]
          : ["M80 102q11-5 22 0", "M138 102q11-5 22 0"];
  return (
    <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round">
      <path d={paths[0]} />
      <path d={paths[1]} />
    </g>
  );
}

function Mouth({ expression, shade }: { expression: PatientExpression; shade: string }) {
  if (expression === "struggling_to_breathe") {
    return <ellipse cx="121" cy="160" rx="10" ry="13" fill="#4e2830" opacity=".9" />;
  }
  if (expression === "anxious") {
    return <ellipse cx="121" cy="159" rx="9" ry="7" fill="#4e2830" opacity=".86" />;
  }
  const path =
    expression === "relieved"
      ? "M106 156q15 17 31 0"
      : expression === "in_pain"
        ? "M106 164q15-13 31 0"
        : expression === "drowsy"
          ? "M110 160q11 3 23 0"
          : "M109 159q12 5 24 0";
  return <path d={path} fill="none" stroke={shade} strokeWidth="3.5" strokeLinecap="round" />;
}
