import type { AssistantStatus } from "./types";

export function AnnieAvatar({
  state = "idle",
  className = "",
}: {
  state?: AssistantStatus;
  className?: string;
}) {
  return (
    <span className={`annie-avatar annie-avatar-${state} relative block ${className}`}>
      <span className="absolute inset-0 rounded-full bg-[#eeeafd]" aria-hidden="true" />
      <img
        src="/annie/annie-editorial.png"
        alt=""
        draggable={false}
        className="relative z-[1] size-full rounded-full object-cover object-top"
      />
      {state === "thinking" && (
        <span
          className="annie-thinking-dots absolute -right-1 -top-1 z-[2] flex gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-sm"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>
      )}
      {state === "awaiting_answer" && (
        <span
          className="absolute bottom-0 right-0 z-[2] size-3.5 rounded-full border-2 border-white bg-amber-400"
          aria-hidden="true"
        />
      )}
      {state === "feedback" && (
        <span
          className="absolute bottom-0 right-0 z-[2] grid size-4 place-items-center rounded-full border-2 border-white bg-emerald-500 text-[8px] font-bold text-white"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
    </span>
  );
}
