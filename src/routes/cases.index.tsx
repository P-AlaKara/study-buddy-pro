import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Flame, Stethoscope, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DIFFICULTY_COLOR,
  SETTING_LABELS,
  fetchCases,
  formatCountdown,
  type CaseRow,
} from "@/lib/cases";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Clinical cases | Medley" },
      {
        name: "description",
        content:
          "Work through realistic patient cases, from history to management, and join the weekly challenge.",
      },
      { property: "og:title", content: "Clinical cases | Medley" },
      {
        property: "og:description",
        content: "Work through realistic patient cases and join the weekly challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaseLibrary,
});

type Entry = {
  id: string;
  student_id: string | null;
  display_name: string;
  mode: string;
  score: number;
  time_taken_seconds: number;
  group_name: string | null;
};

function CaseLibrary() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [board, setBoard] = useState<Entry[]>([]);
  const [boardMode, setBoardMode] = useState<"solo" | "team">("solo");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .finally(() => setLoading(false));
    Promise.all([
      supabase
        .from("challenge_participants")
        .select("id,student_id,display_name,mode,score,time_taken_seconds,group_name")
        .order("score", { ascending: false })
        .order("time_taken_seconds"),
      supabase.from("leaderboard_opt_outs").select("student_id"),
    ]).then(([participants, optOuts]) => {
      const excluded = new Set((optOuts.data ?? []).map((item) => item.student_id));
      setBoard(
        ((participants.data ?? []) as Entry[]).filter(
          (item) => !item.student_id || !excluded.has(item.student_id),
        ),
      );
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const weekly = cases.find((c) => c.is_weekly_challenge);
  const specialties = useMemo(() => ["all", ...new Set(cases.map((c) => c.specialty))], [cases]);
  const shown = cases.filter(
    (c) =>
      (difficulty === "all" || c.difficulty === difficulty) &&
      (specialty === "all" || c.specialty === specialty),
  );

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-extrabold tracking-widest text-lavender">CLINICAL CASES</p>
        <h1 className="mt-1 text-3xl font-black">Think like a clinician</h1>
        <p className="mt-2 text-muted-foreground">
          Take a history, examine, investigate and treat — then see how your patient does.
        </p>
      </div>

      {weekly && (
        <div className="clay-card bg-lavender-soft p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Flame className="h-4 w-4 text-pink" /> Weekly challenge · ends in{" "}
            {formatCountdown(weekly.challenge_end, now)}
          </div>
          <h2 className="mt-2 text-2xl font-black">{weekly.title}</h2>
          <p className="mt-1 text-muted-foreground">{weekly.teaser}</p>
          <Link
            to="/cases/$caseId"
            params={{ caseId: weekly.id }}
            className="mt-4 inline-flex rounded-full bg-lavender px-6 py-3 font-extrabold text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            Start challenge
          </Link>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "easy", "medium", "hard"].map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {d === "all" ? "Any level" : d}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {specialties.map((s) => (
            <Chip key={s} active={specialty === s} onClick={() => setSpecialty(s)}>
              {s === "all" ? "All specialties" : s}
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading cases…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Link
              key={c.id}
              to="/cases/$caseId"
              params={{ caseId: c.id }}
              className="clay-card block bg-card p-5 transition-transform hover:-translate-y-1"
            >
              <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                <span
                  className={`rounded-full px-3 py-1 capitalize ${DIFFICULTY_COLOR[c.difficulty]}`}
                >
                  {c.difficulty}
                </span>
                <span className="rounded-full bg-muted px-3 py-1">
                  {SETTING_LABELS[c.clinical_setting] ?? c.clinical_setting}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black leading-snug">{c.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.teaser}</p>
              <div className="mt-4 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {c.estimated_minutes} min
                </span>
                <span className="flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {c.specialty}
                </span>
                <span>+{c.xp_reward} XP</span>
              </div>
            </Link>
          ))}
          {!shown.length && <p className="text-muted-foreground">No cases match these filters.</p>}
        </div>
      )}

      <div className="clay-card bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Trophy className="h-5 w-5 text-yellow" /> Leaderboard
          </h2>
          <div className="flex gap-1">
            {(["solo", "team"] as const).map((m) => (
              <Chip key={m} active={boardMode === m} onClick={() => setBoardMode(m)}>
                {m === "solo" ? (
                  "Solo"
                ) : (
                  <>
                    <Users className="h-3.5 w-3.5" /> Teams
                  </>
                )}
              </Chip>
            ))}
          </div>
        </div>
        <ol className="mt-4 space-y-2">
          {board
            .filter((e) => e.mode === boardMode)
            .map((e, i) => (
              <li
                key={e.id}
                className={`flex items-center gap-3 rounded-2xl p-3 ${i < 3 ? "bg-yellow-soft" : "bg-muted"}`}
              >
                <span className="w-6 text-center font-black">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-extrabold">{e.display_name}</p>
                  <p className="text-xs text-muted-foreground">{e.group_name}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(e.time_taken_seconds / 60)} min
                </span>
                <span className="font-black">{e.score}</span>
              </li>
            ))}
          {!board.some((e) => e.mode === boardMode) && (
            <p className="text-sm text-muted-foreground">No entries yet — be the first.</p>
          )}
        </ol>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-sm font-extrabold capitalize transition-all active:scale-95 ${active ? "bg-lavender text-primary-foreground shadow-md" : "bg-lavender-soft"}`}
    >
      {children}
    </button>
  );
}
