import { useState } from "react";
import {
  BellOff,
  ChevronDown,
  ChevronUp,
  MessageCircleQuestion,
  Moon,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { AnnieAvatar } from "./annie-avatar";
import { CHATTINESS_LABELS } from "./config";
import type { AnnieMood, AnnieSettings, AnnieState, QuizCandidate } from "./types";

export type AnnieBubble = {
  id: number;
  type: "commentary" | "quiz" | "answer" | "result";
  text: string;
  beyondNotes?: boolean;
};

const moods: Array<{ value: AnnieMood; label: string }> = [
  { value: "stern", label: "Stern" },
  { value: "friendly", label: "Friendly" },
  { value: "cheeky", label: "Cheeky" },
];

export function AnniePanel({
  settings,
  state,
  bubble,
  activeQuiz,
  silenced,
  onSettings,
  onDismiss,
  onSilence,
  onQuizNow,
  onSubmitQuiz,
  onRevealQuiz,
  onAsk,
}: {
  settings: AnnieSettings;
  state: AnnieState;
  bubble: AnnieBubble | null;
  activeQuiz: QuizCandidate | null;
  silenced: boolean;
  onSettings: (settings: AnnieSettings) => void;
  onDismiss: () => void;
  onSilence: (choice: "ten_minutes" | "session" | "forever" | "off") => void;
  onQuizNow: () => void;
  onSubmitQuiz: (answer: string) => Promise<void>;
  onRevealQuiz: (kind: "show" | "skip") => Promise<void>;
  onAsk: (question: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [silenceOpen, setSilenceOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    await onSubmitQuiz(answer.trim()).finally(() => setBusy(false));
    setAnswer("");
  }

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    await onAsk(question.trim()).finally(() => setBusy(false));
    setQuestion("");
    setAskOpen(false);
  }

  return (
    <section
      className="sticky top-[65px] z-30 border-b border-[#ddd7cd] bg-[#f8f5ee]/95 px-3 py-2 backdrop-blur sm:top-[73px] sm:px-5"
      aria-label="Annie study companion"
    >
      <div
        className={`mx-auto w-full max-w-[1320px] overflow-visible rounded-[24px] bg-white shadow-[0_12px_30px_-24px_rgba(25,25,35,.5),inset_0_2px_1px_rgba(255,255,255,.9)] transition-all ${collapsed ? "p-2" : "p-3 sm:p-4"}`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAskOpen((open) => !open)}
            className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#7566b7]"
            aria-label="Ask Annie about this page"
          >
            <AnnieAvatar
              mood={settings.mood}
              state={silenced ? "idle" : state}
              muted={silenced}
              className={`${collapsed ? "w-12" : "w-16 sm:w-20"} transition-[width]`}
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-slate-900">Annie</span>
              <span className="rounded-full bg-[#eeeafd] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#6d5fb1]">
                {settings.mood}
              </span>
              {silenced && (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                  <Moon className="size-3" /> Quiet
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="mt-1">
                {silenced ? (
                  <p className="text-sm font-bold text-slate-400">I’m here, just keeping quiet.</p>
                ) : bubble ? (
                  <button
                    type="button"
                    onClick={() => bubble.type === "commentary" && setAskOpen(true)}
                    className="group relative max-w-3xl rounded-2xl rounded-tl-md bg-[#f5f1ff] px-4 py-2.5 text-left text-sm font-bold leading-relaxed text-slate-700"
                    aria-label="Annie message"
                  >
                    {bubble.beyondNotes && (
                      <span className="mr-1 font-black text-[#6d5fb1]">Beyond your notes:</span>
                    )}
                    {bubble.text}
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-slate-400">
                    Reading along on this page.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSilenceOpen((open) => !open)}
                className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7566b7]"
                aria-label={silenced ? "Turn Annie back on" : "Silence Annie"}
                aria-expanded={silenceOpen}
              >
                {silenced ? <Volume2 className="size-5" /> : <BellOff className="size-5" />}
              </button>
              {silenceOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5">
                  {(silenced
                    ? [["off", "Turn Annie back on"]]
                    : [
                        ["ten_minutes", "Quiet for 10 minutes"],
                        ["session", "Quiet this session"],
                        ["forever", "Quiet until I turn it on"],
                      ]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        onSilence(value as "ten_minutes" | "session" | "forever" | "off");
                        setSilenceOpen(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs font-extrabold text-slate-600 hover:bg-slate-100"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7566b7]"
                aria-label="Annie settings"
                aria-expanded={settingsOpen}
              >
                <Settings2 className="size-5" />
              </button>
            )}
            {bubble && (!activeQuiz || bubble.type !== "quiz") && !collapsed && (
              <button
                type="button"
                onClick={onDismiss}
                className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label="Dismiss Annie message"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label={collapsed ? "Expand Annie panel" : "Collapse Annie panel"}
            >
              {collapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
            </button>
          </div>
        </div>

        {!collapsed && !silenced && activeQuiz && bubble?.type === "quiz" && (
          <form
            onSubmit={submitAnswer}
            className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_auto]"
          >
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="h-11 rounded-2xl bg-[#f7f5ef] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#7566b7]"
              placeholder="Type what you remember…"
              aria-label="Your answer"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || !answer.trim()}
                className="clay-button inline-flex h-11 items-center gap-2 rounded-full bg-[#7566b7] px-4 text-xs font-black text-white disabled:opacity-50"
              >
                <Send className="size-4" /> Check
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRevealQuiz("show")}
                className="h-11 rounded-full bg-[#e3f7ef] px-4 text-xs font-black text-[#16785f]"
              >
                Show me
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRevealQuiz("skip")}
                className="h-11 rounded-full px-3 text-xs font-black text-slate-500 hover:bg-slate-100"
              >
                Skip
              </button>
            </div>
          </form>
        )}

        {!collapsed && askOpen && !silenced && (
          <form
            onSubmit={submitQuestion}
            className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row"
          >
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[#f7f5ef] px-4 focus-within:ring-2 focus-within:ring-[#7566b7]">
              <MessageCircleQuestion className="size-4 shrink-0 text-[#7566b7]" />
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                placeholder="Ask about this page…"
                aria-label="Ask Annie about the current page"
                maxLength={600}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="clay-button inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7566b7] px-5 text-xs font-black text-white disabled:opacity-50"
            >
              <Send className="size-4" /> Ask Annie
            </button>
          </form>
        )}

        {!collapsed && settingsOpen && (
          <div className="mt-3 grid gap-4 border-t border-slate-100 pt-3 md:grid-cols-3">
            <fieldset>
              <legend className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Mood
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {moods.map((mood) => (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => onSettings({ ...settings, mood: mood.value })}
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${settings.mood === mood.value ? "bg-[#7566b7] text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {mood.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Chattiness
              <select
                value={settings.chattiness}
                onChange={(event) =>
                  onSettings({
                    ...settings,
                    chattiness: event.target.value as AnnieSettings["chattiness"],
                  })
                }
                className="mt-2 block h-9 w-full rounded-xl bg-slate-100 px-3 text-xs font-extrabold normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#7566b7]"
              >
                {Object.entries(CHATTINESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Behaviors
              </legend>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-extrabold text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.quizzes_enabled}
                    onChange={(event) =>
                      onSettings({ ...settings, quizzes_enabled: event.target.checked })
                    }
                    className="accent-[#7566b7]"
                  />{" "}
                  Quizzes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.commentary_enabled}
                    onChange={(event) =>
                      onSettings({ ...settings, commentary_enabled: event.target.checked })
                    }
                    className="accent-[#7566b7]"
                  />{" "}
                  Commentary
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {!collapsed && !silenced && !activeQuiz && (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onQuizNow}
              disabled={!settings.quizzes_enabled}
              className="inline-flex items-center gap-2 rounded-full bg-[#fff0ec] px-4 py-2 text-xs font-black text-[#a14839] disabled:opacity-40"
            >
              <Sparkles className="size-4" /> Quiz me now
            </button>
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {bubble ? `Annie says: ${bubble.text}` : ""}
      </div>
    </section>
  );
}
