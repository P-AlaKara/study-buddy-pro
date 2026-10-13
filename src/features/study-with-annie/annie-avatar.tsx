import type { AnnieMood, AnnieState } from "./types";

export function AnnieAvatar({
  mood,
  state,
  muted = false,
  className = "",
}: {
  mood: AnnieMood;
  state: AnnieState;
  muted?: boolean;
  className?: string;
}) {
  const smiling = state === "celebrating" || mood === "friendly";
  const teasing = state === "teasing" || mood === "cheeky";
  const disappointed = state === "disappointed";
  const eyesClosed = muted;
  const colors = {
    stern: { shirt: "#7566b7", background: "#eeeafd" },
    friendly: { shirt: "#e8809b", background: "#fff0f3" },
    cheeky: { shirt: "#2aa78b", background: "#e3f7ef" },
  }[mood];

  return (
    <svg
      viewBox="0 0 180 180"
      role="img"
      aria-label={`Annie, your ${mood} study companion, is ${muted ? "sleeping" : state}`}
      className={`annie-avatar ${muted ? "opacity-65 grayscale-[0.2]" : ""} ${className}`}
    >
      <circle cx="90" cy="90" r="84" fill={colors.background} />
      <path d="M35 166c6-36 26-52 55-52s49 16 55 52" fill={colors.shirt} />
      <path d="M58 91c-11-50 11-75 40-70 33 5 41 43 25 86l-22 17-41-11z" fill="#49362f" />
      <path
        d="M61 80c0-30 15-48 36-48 23 0 37 19 34 50-2 26-18 43-36 43-19 0-34-19-34-45z"
        fill="#9a5e43"
      />
      <path
        d="M61 70c4-30 18-42 38-40 18 1 31 14 33 36-17-5-30-16-36-27-5 16-17 28-35 35z"
        fill="#49362f"
      />
      {eyesClosed ? (
        <>
          <path
            d="M72 84q7 5 14 0"
            fill="none"
            stroke="#332822"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M104 84q7 5 14 0"
            fill="none"
            stroke="#332822"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x="133" y="56" fill="#7566b7" fontSize="18" fontWeight="800">
            z
          </text>
          <text x="146" y="39" fill="#7566b7" fontSize="13" fontWeight="800">
            z
          </text>
        </>
      ) : teasing ? (
        <>
          <path
            d="M72 84q7-5 14 0"
            fill="none"
            stroke="#332822"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="111" cy="83" r="3.2" fill="#332822" />
        </>
      ) : (
        <>
          <circle cx="80" cy="83" r="3.2" fill="#332822" />
          <circle cx="111" cy="83" r="3.2" fill="#332822" />
        </>
      )}
      {mood === "stern" && !eyesClosed && (
        <>
          <path d="M71 74l14-3" stroke="#332822" strokeWidth="3" strokeLinecap="round" />
          <path d="M104 71l14 3" stroke="#332822" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {disappointed ? (
        <path
          d="M85 108q10-8 20 0"
          fill="none"
          stroke="#633b34"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : smiling ? (
        <path
          d="M83 101q12 16 25 0"
          fill="#fff"
          stroke="#633b34"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : teasing ? (
        <path
          d="M85 102q11 10 22 1"
          fill="none"
          stroke="#633b34"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <path d="M87 104h18" stroke="#633b34" strokeWidth="3" strokeLinecap="round" />
      )}
      {state === "thinking" && (
        <g fill="#7566b7">
          <circle cx="142" cy="55" r="5" />
          <circle cx="153" cy="43" r="3.5" />
          <circle cx="160" cy="32" r="2.5" />
        </g>
      )}
      {state === "celebrating" && (
        <g fill="#f3b51b">
          <path d="M38 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path d="M145 82l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
      )}
    </svg>
  );
}
