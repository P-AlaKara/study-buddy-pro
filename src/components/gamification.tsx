import {
  useEffect,
  useState,
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  HeartPulse,
  Layers3,
  Lock,
  Medal,
  NotebookPen,
  Search,
  Sparkles,
  Stethoscope,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ActingStudent } from "@/components/study-app";
import type { Json } from "@/integrations/supabase/types";

const LEVELS = [0, 250, 600, 1100, 1800, 2700, 3800, 5100, 6600, 8300, 10200];
const notificationSettings = [
  ["weekly_case_released", "Weekly case released"],
  ["weekly_case_ending", "Weekly case ending"],
  ["flashcards_due", "Flashcards due"],
  ["group_invites", "Group invites"],
  ["team_case_invites", "Team case invites"],
  ["challenge_invites", "Challenge invites"],
  ["group_activity", "Group activity"],
  ["session_reminders", "Session reminders"],
  ["achievements", "Achievements"],
  ["study_goals", "Study goals"],
] as const;

type SearchItem = { id: string; title: string; detail: string; href: string };
type SearchGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  items: SearchItem[];
};
type Achievement = { id: string; name: string; description: string; icon: string; criteria: Json };
type Earned = { achievement_id: string; earned_at: string };
type Mastery = {
  id: string;
  subject_or_system: string;
  competency: string;
  level_label: string;
  numeric_score: number;
};

export function levelProgress(xp: number, level: number) {
  const start = LEVELS[Math.max(0, level - 1)] ?? 0;
  const end = LEVELS[level] ?? start + 2000;
  return {
    start,
    end,
    current: Math.max(0, xp - start),
    needed: end - start,
    percent: Math.min(100, Math.max(0, ((xp - start) / Math.max(1, end - start)) * 100)),
  };
}

export function XpLevelCard({
  student,
  compact = false,
}: {
  student?: ActingStudent;
  compact?: boolean;
}) {
  const xp = student?.xp ?? 0;
  const level = student?.level ?? 1;
  const p = levelProgress(xp, level);
  return (
    <div
      className={`${compact ? "rounded-[20px] p-4" : "clay-card rounded-[28px] p-6"} overflow-hidden bg-lavender-soft`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`${compact ? "size-11 text-lg" : "size-14 text-2xl"} flex items-center justify-center rounded-2xl bg-lavender font-display font-black text-white shadow-md`}
          >
            {level}
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ink-soft">
              Level {level}
            </p>
            <p className="font-display font-black">{xp.toLocaleString()} XP</p>
          </div>
        </div>
        <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-extrabold">
          {p.current}/{p.needed} to level {level + 1}
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-card/70 soft-inset">
        <div
          className="xp-shimmer h-full rounded-full progress-gradient transition-[width] duration-700"
          style={{ width: `${p.percent}%` }}
        />
      </div>
    </div>
  );
}

export function StudentUtilities({ student }: { student?: ActingStudent }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!student) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [student?.id, notificationsOpen]);
  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => setSearchOpen(true)}
          className="clay-button flex size-11 shrink-0 items-center justify-center bg-card sm:size-10"
          aria-label="Search everything"
        >
          <Search size={18} />
        </button>
        <Link
          to="/leaderboards"
          className="clay-button hidden size-11 shrink-0 items-center justify-center bg-yellow-soft sm:flex sm:size-10"
          aria-label="Leaderboards"
        >
          <Medal size={18} />
        </Link>
        <button
          onClick={() => setNotificationsOpen(true)}
          className="clay-button relative flex size-11 shrink-0 items-center justify-center bg-card sm:size-10"
          aria-label={`${unread} unread notifications`}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-pink text-[10px] font-black text-white">
              {Math.min(9, unread)}
            </span>
          )}
        </button>
      </div>
      {searchOpen && <SearchCenter onClose={() => setSearchOpen(false)} />}
      {notificationsOpen && student && (
        <NotificationsCenter student={student} onClose={() => setNotificationsOpen(false)} />
      )}
    </>
  );
}

function Modal({
  label,
  onClose,
  children,
  wide = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/30 p-3 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`clay-card w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[84vh] overflow-hidden bg-card`}
      >
        <div className="flex items-center justify-between border-b border-border p-4 md:px-6">
          <h2 className="font-display text-xl font-black">{label}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchCenter({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      setGroups([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const term = `%${query.trim()}%`;
      const [cases, questions, stations, decks, studyGroups, resources] = await Promise.all([
        supabase
          .from("cases")
          .select("id,title,specialty,topic")
          .or(`title.ilike.${term},topic.ilike.${term},specialty.ilike.${term}`)
          .limit(6),
        supabase
          .from("quiz_questions")
          .select("id,question_text,subject,topic")
          .or(`question_text.ilike.${term},topic.ilike.${term},subject.ilike.${term}`)
          .limit(6),
        supabase
          .from("osce_stations")
          .select("id,title,specialty,topic")
          .or(`title.ilike.${term},topic.ilike.${term},specialty.ilike.${term}`)
          .limit(6),
        supabase
          .from("flashcard_decks")
          .select("id,title,subject,topic")
          .or(`title.ilike.${term},topic.ilike.${term},subject.ilike.${term}`)
          .limit(6),
        supabase
          .from("groups")
          .select("id,name,description")
          .or(`name.ilike.${term},description.ilike.${term}`)
          .limit(6),
        supabase
          .from("group_shared_resources")
          .select("id,title,resource_type,resource_ref")
          .ilike("title", term)
          .limit(6),
      ]);
      setGroups(
        [
          {
            label: "Cases",
            icon: HeartPulse,
            color: "bg-lavender-soft",
            items: (cases.data ?? []).map((x) => ({
              id: x.id,
              title: x.title,
              detail: `${x.specialty} · ${x.topic}`,
              href: `/cases/${x.id}`,
            })),
          },
          {
            label: "Quiz topics",
            icon: Brain,
            color: "bg-blue-soft",
            items: (questions.data ?? []).map((x) => ({
              id: x.id,
              title: x.question_text,
              detail: `${x.subject} · ${x.topic}`,
              href: "/quiz",
            })),
          },
          {
            label: "OSCE stations",
            icon: Stethoscope,
            color: "bg-pink-soft",
            items: (stations.data ?? []).map((x) => ({
              id: x.id,
              title: x.title,
              detail: `${x.specialty} · ${x.topic}`,
              href: `/osce/${x.id}`,
            })),
          },
          {
            label: "Flashcard decks",
            icon: Layers3,
            color: "bg-yellow-soft",
            items: (decks.data ?? []).map((x) => ({
              id: x.id,
              title: x.title,
              detail: `${x.subject} · ${x.topic}`,
              href: `/flashcards/${x.id}`,
            })),
          },
          {
            label: "Groups",
            icon: Users,
            color: "bg-mint-soft",
            items: (studyGroups.data ?? []).map((x) => ({
              id: x.id,
              title: x.name,
              detail: x.description,
              href: `/groups/${x.id}`,
            })),
          },
          {
            label: "Resources",
            icon: BookOpen,
            color: "bg-card",
            items: (resources.data ?? []).map((x) => ({
              id: x.id,
              title: x.title,
              detail: x.resource_type,
              href:
                x.resource_type === "case"
                  ? `/cases/${x.resource_ref}`
                  : x.resource_type === "deck"
                    ? `/flashcards/${x.resource_ref}`
                    : "/groups",
            })),
          },
        ].filter((g) => g.items.length),
      );
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  return (
    <Modal label="Search Medley" onClose={onClose} wide>
      <div className="p-4 md:p-6">
        <label className="flex items-center gap-3 rounded-full bg-muted px-4 soft-inset">
          <Search className="text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, topics, stations, decks, groups…"
            className="h-12 w-full bg-transparent outline-none"
          />
        </label>
        <div className="mt-5 max-h-[58vh] space-y-6 overflow-y-auto pr-1">
          {loading && (
            <p className="py-8 text-center text-sm font-bold text-muted-foreground">
              Searching your study library…
            </p>
          )}
          {!loading && query.length < 2 && (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto text-lavender" />
              <p className="mt-3 font-display text-lg font-black">Everything, one search away</p>
              <p className="text-sm text-muted-foreground">
                Type at least two characters to begin.
              </p>
            </div>
          )}
          {!loading && query.length >= 2 && !groups.length && (
            <p className="py-10 text-center text-muted-foreground">
              No matches yet. Try a subject, symptom, or skill.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink-soft">
                <group.icon className="size-4" />
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl ${group.color} p-3 hover:-translate-y-0.5`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function NotificationsCenter({
  student,
  onClose,
}: {
  student: ActingStudent;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      type: string;
      message: string;
      is_read: boolean;
      created_at: string;
      related_link: string | null;
    }>
  >([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  useEffect(() => {
    const prefs = (
      student.notification_prefs &&
      typeof student.notification_prefs === "object" &&
      !Array.isArray(student.notification_prefs)
        ? student.notification_prefs
        : {}
    ) as Record<string, boolean>;
    setSettings(Object.fromEntries(notificationSettings.map(([key]) => [key, prefs[key] ?? true])));
    supabase
      .from("notifications")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => setItems(data ?? []));
  }, [student.id]);
  async function read(id: string) {
    setItems((v) => v.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }
  async function toggle(key: string, value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await supabase.from("students").update({ notification_prefs: next }).eq("id", student.id);
  }
  return (
    <Modal label="Notifications" onClose={onClose}>
      <div className="flex gap-2 px-4 pt-4 md:px-6">
        <Button
          size="sm"
          variant={tab === "inbox" ? "lavender" : "secondary"}
          onClick={() => setTab("inbox")}
        >
          Inbox
        </Button>
        <Button
          size="sm"
          variant={tab === "settings" ? "lavender" : "secondary"}
          onClick={() => setTab("settings")}
        >
          Settings
        </Button>
      </div>
      <div className="max-h-[64vh] overflow-y-auto p-4 md:p-6">
        {tab === "inbox" ? (
          <div className="space-y-3">
            {items.map((n) => (
              <a
                key={n.id}
                href={n.related_link ?? "#"}
                onClick={() => read(n.id)}
                className={`block rounded-2xl p-4 ${n.is_read ? "bg-muted" : "bg-lavender-soft ring-1 ring-lavender"}`}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${n.is_read ? "bg-border" : "bg-pink"}`}
                  />
                  <div>
                    <p className="text-sm font-bold">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {n.type.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
              </a>
            ))}
            {!items.length && (
              <p className="py-10 text-center text-muted-foreground">You’re all caught up.</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {notificationSettings.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm font-bold"
              >
                <span>{label}</span>
                <Switch checked={settings[key] ?? true} onCheckedChange={(v) => toggle(key, v)} />
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function CelebrationLayer({ student }: { student?: ActingStudent }) {
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [badge, setBadge] = useState<Achievement | null>(null);
  useEffect(() => {
    if (!student) return;
    const key = `medley-level-${student.id}`;
    const old = Number(localStorage.getItem(key) ?? student.level);
    if (student.level > old) setLevelUp(student.level);
    localStorage.setItem(key, String(student.level));
  }, [student?.id, student?.level]);
  useEffect(() => {
    if (!student) return;
    let first = true;
    const check = async () => {
      const [{ data: earned }, { data: all }] = await Promise.all([
        supabase.from("student_achievements").select("achievement_id").eq("student_id", student.id),
        supabase.from("achievements").select("*"),
      ]);
      const ids = (earned ?? []).map((x) => x.achievement_id);
      const key = `medley-earned-${student.id}`;
      const known = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      if (!first) {
        const found = ids.find((id) => !known.includes(id));
        if (found) setBadge((all ?? []).find((a) => a.id === found) ?? null);
      }
      localStorage.setItem(key, JSON.stringify(ids));
      first = false;
    };
    void check();
    const timer = setInterval(check, 12000);
    return () => clearInterval(timer);
  }, [student?.id]);
  const close = () => {
    setLevelUp(null);
    setBadge(null);
  };
  if (!levelUp && !badge) return null;
  return (
    <div
      className="celebration fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-gradient-to-br from-lavender via-pink to-yellow p-5"
      role="dialog"
      aria-modal="true"
    >
      <Confetti />
      <div className="relative z-10 max-w-md text-center">
        <div className="mx-auto flex size-28 items-center justify-center rounded-[38px] bg-card text-6xl shadow-2xl">
          {badge?.icon ?? "🌟"}
        </div>
        <p className="mt-7 text-sm font-black uppercase tracking-[.25em]">
          {badge ? "Achievement unlocked" : "Level up"}
        </p>
        <h2 className="mt-2 font-display text-4xl font-black md:text-6xl">
          {badge?.name ?? `Level ${levelUp}`}
        </h2>
        <p className="mx-auto mt-3 max-w-sm font-bold text-ink-soft">
          {badge?.description ?? "Your steady practice is paying off. Keep the momentum going!"}
        </p>
        <Button className="mt-7 bg-foreground text-white" onClick={close}>
          Keep going <Sparkles />
        </Button>
      </div>
    </div>
  );
}
function Confetti() {
  return (
    <div aria-hidden className="absolute inset-0">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 9) * -0.18}s`,
            background: ["var(--pink)", "var(--yellow)", "var(--mint)", "var(--blue)"][i % 4],
          }}
        />
      ))}
    </div>
  );
}

export function HomeGamification({ student }: { student?: ActingStudent }) {
  const [due, setDue] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  useEffect(() => {
    if (!student) return;
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [reviews, xp, earned] = await Promise.all([
        supabase
          .from("flashcard_reviews")
          .select("id", { count: "exact", head: true })
          .eq("student_id", student.id)
          .lte("due_date", new Date().toISOString()),
        supabase
          .from("xp_events")
          .select("xp_amount")
          .eq("student_id", student.id)
          .gte("created_at", start.toISOString()),
        supabase
          .from("student_achievements")
          .select("earned_at,achievements(*)")
          .eq("student_id", student.id)
          .order("earned_at", { ascending: false })
          .limit(1),
      ]);
      setDue(reviews.count ?? 0);
      setTodayXp((xp.data ?? []).reduce((n, x) => n + x.xp_amount, 0));
      const row = earned.data?.[0] as unknown as { achievements: Achievement | null } | undefined;
      setAchievement(row?.achievements ?? null);
    })();
  }, [student?.id]);
  return (
    <div className="space-y-6">
      <XpLevelCard student={student} />
      <section className="clay-card bg-card p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-display text-2xl font-black">+{todayXp}</p>
            <p className="text-xs text-muted-foreground">XP today</p>
          </div>
          <div>
            <p className="font-display text-2xl font-black">{student?.level ?? 1}</p>
            <p className="text-xs text-muted-foreground">Level</p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 font-display text-2xl font-black">
              <Flame className="size-5 text-pink" />
              {student?.streak_days ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
        </div>
      </section>
      <section className="clay-card bg-yellow-soft p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ink-soft">Quick review</p>
            <h2 className="mt-1 font-display text-xl font-black">Flashcards due</h2>
          </div>
          <Layers3 />
        </div>
        <div className="my-5 flex items-end gap-2">
          <span className="font-display text-5xl font-black">{due}</span>
          <span className="pb-1 text-sm font-bold text-ink-soft">cards ready</span>
        </div>
        <Button variant="yellow" className="w-full" asChild>
          <Link to="/flashcards/review">
            Review now <ChevronRight />
          </Link>
        </Button>
      </section>
      <section className="clay-card bg-pink-soft p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-black">Latest achievement</h2>
          <Trophy />
        </div>
        {achievement ? (
          <div className="mt-5 flex items-center gap-3">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-yellow text-2xl shadow-sm">
              {achievement.icon}
            </span>
            <div>
              <p className="font-display font-black">{achievement.name}</p>
              <p className="text-sm text-ink-soft">{achievement.description}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Your first badge is just around the corner.</p>
        )}
        <Button variant="secondary" size="sm" className="mt-5" asChild>
          <Link to="/profile">View all badges</Link>
        </Button>
      </section>
    </div>
  );
}

export function HomeMasteryPreview({ student }: { student?: ActingStudent }) {
  const [rows, setRows] = useState<Mastery[]>([]);
  useEffect(() => {
    if (!student) return;
    supabase
      .from("mastery_scores")
      .select("*")
      .eq("student_id", student.id)
      .order("numeric_score")
      .limit(3)
      .then(({ data }) => setRows(data ?? []));
  }, [student?.id]);
  return (
    <div className="clay-card bg-card p-5 md:p-6">
      <p className="mb-5 text-sm text-muted-foreground">
        Recommended practice from your real activity.
      </p>
      {rows.map((x) => (
        <div key={x.id} className="mb-4 last:mb-0">
          <div className="mb-2 flex justify-between gap-2 text-sm font-bold">
            <span>
              {x.subject_or_system} · {x.competency}
            </span>
            <span className="text-ink-soft">{x.numeric_score}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted soft-inset">
            <div
              className={`h-full rounded-full ${x.level_label === "strong" ? "bg-mint" : x.level_label === "developing" ? "bg-yellow" : "bg-pink"}`}
              style={{ width: `${x.numeric_score}%` }}
            />
          </div>
        </div>
      ))}
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          Complete a practice activity to build your map.
        </p>
      )}
    </div>
  );
}

export function NoteButton({
  studentId,
  contentType,
  contentId,
}: {
  studentId?: string;
  contentType: "case" | "quiz_question" | "flashcard" | "osce_station";
  contentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!studentId || !text.trim()) return;
    const { error } = await supabase.from("notes").insert({
      student_id: studentId,
      content_type: contentType,
      content_id: contentId,
      note_text: text.trim(),
      is_shared: shared,
    });
    if (!error) {
      setSaved(true);
      setTimeout(() => setOpen(false), 500);
    }
  }
  return (
    <>
      {
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <NotebookPen /> Add note
        </Button>
      }
      {open && (
        <Modal label="Add a personal note" onClose={() => setOpen(false)}>
          <div className="p-5 md:p-6">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Capture a clinical pearl, reminder, or question…"
              className="min-h-32 w-full rounded-2xl bg-muted p-4 outline-none ring-primary focus:ring-2"
            />
            <label className="mt-4 flex items-center justify-between gap-4 text-sm font-bold">
              <span>
                <span className="block">Share this note</span>
                <span className="text-xs font-medium text-muted-foreground">
                  Private by default
                </span>
              </span>
              <Switch checked={shared} onCheckedChange={setShared} />
            </label>
            <Button className="mt-5 w-full" disabled={!studentId || !text.trim()} onClick={save}>
              {saved ? (
                <>
                  <Check /> Saved
                </>
              ) : (
                "Save note"
              )}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function SaveItemButton({
  studentId,
  contentType,
  contentId,
  title,
  href,
}: {
  studentId?: string;
  contentType: "case" | "osce_station" | "resource";
  contentId: string;
  title: string;
  href: string;
}) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!studentId) return;
    supabase
      .from("saved_items")
      .select("id")
      .eq("student_id", studentId)
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle()
      .then(({ data }) => setSaved(Boolean(data)));
  }, [studentId, contentType, contentId]);
  async function toggle() {
    if (!studentId) return;
    if (saved)
      await supabase
        .from("saved_items")
        .delete()
        .eq("student_id", studentId)
        .eq("content_type", contentType)
        .eq("content_id", contentId);
    else
      await supabase.from("saved_items").insert({
        student_id: studentId,
        content_type: contentType,
        content_id: contentId,
        title,
        related_link: href,
      });
    setSaved(!saved);
  }
  return (
    <Button variant="secondary" size="sm" onClick={toggle}>
      <Bookmark className={saved ? "fill-current text-lavender" : ""} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

type DashboardData = {
  xp: Array<{ xp_amount: number; source_type: string; created_at: string }>;
  cases: Array<{
    id: string;
    total_score: number | null;
    completed_at: string | null;
    started_at: string;
  }>;
  quizzes: Array<{
    id: string;
    score: number | null;
    started_at: string;
    completed_at: string | null;
  }>;
  osces: Array<{ id: string; score: number; time_taken_seconds: number; completed_at: string }>;
  reviews: Array<{ id: string; created_at: string; last_reviewed_at: string | null }>;
  mastery: Mastery[];
  achievements: Achievement[];
  earned: Earned[];
  challenges: Array<{ id: string; score: number; rank: number | null; created_at: string }>;
  notes: Array<{
    id: string;
    content_type: string;
    note_text: string;
    is_shared: boolean;
    created_at: string;
  }>;
  saved: Array<{
    id: string;
    content_type: string;
    title: string;
    related_link: string;
    created_at: string;
  }>;
  questions: Array<{ id: string; quiz_questions: { question_text: string } | null }>;
  decks: Array<{ id: string; flashcard_decks: { title: string } | null }>;
};

export function ProgressDashboard({ student }: { student?: ActingStudent }) {
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const [tab, setTab] = useState<"overview" | "achievements" | "saved" | "notes">("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  useEffect(() => {
    if (!student) return;
    (async () => {
      const [
        xp,
        cases,
        quizzes,
        osces,
        reviews,
        mastery,
        achievements,
        earned,
        challenges,
        notes,
        saved,
        questions,
        decks,
        optout,
      ] = await Promise.all([
        supabase
          .from("xp_events")
          .select("xp_amount,source_type,created_at")
          .eq("student_id", student.id),
        supabase
          .from("case_attempts")
          .select("id,total_score,completed_at,started_at")
          .eq("student_id", student.id)
          .eq("status", "completed"),
        supabase
          .from("quiz_sessions")
          .select("id,score,started_at,completed_at")
          .eq("student_id", student.id)
          .not("completed_at", "is", null),
        supabase
          .from("osce_attempts")
          .select("id,score,time_taken_seconds,completed_at")
          .eq("student_id", student.id),
        supabase
          .from("flashcard_reviews")
          .select("id,created_at,last_reviewed_at")
          .eq("student_id", student.id),
        supabase
          .from("mastery_scores")
          .select("*")
          .eq("student_id", student.id)
          .order("subject_or_system"),
        supabase.from("achievements").select("*").order("name"),
        supabase
          .from("student_achievements")
          .select("achievement_id,earned_at")
          .eq("student_id", student.id),
        supabase
          .from("challenge_participants")
          .select("id,score,rank,created_at")
          .eq("student_id", student.id),
        supabase
          .from("notes")
          .select("id,content_type,note_text,is_shared,created_at")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_items")
          .select("id,content_type,title,related_link,created_at")
          .eq("student_id", student.id),
        supabase
          .from("bookmarked_questions")
          .select("id,quiz_questions(question_text)")
          .eq("student_id", student.id),
        supabase
          .from("saved_decks")
          .select("id,flashcard_decks(title)")
          .eq("student_id", student.id),
        supabase
          .from("leaderboard_opt_outs")
          .select("student_id")
          .eq("student_id", student.id)
          .maybeSingle(),
      ]);
      setData({
        xp: xp.data ?? [],
        cases: cases.data ?? [],
        quizzes: quizzes.data ?? [],
        osces: osces.data ?? [],
        reviews: reviews.data ?? [],
        mastery: mastery.data ?? [],
        achievements: achievements.data ?? [],
        earned: earned.data ?? [],
        challenges: challenges.data ?? [],
        notes: notes.data ?? [],
        saved: saved.data ?? [],
        questions: (questions.data ?? []) as DashboardData["questions"],
        decks: (decks.data ?? []) as DashboardData["decks"],
      });
      setOptedOut(Boolean(optout.data));
    })();
  }, [student?.id]);
  const since = range === "all" ? 0 : Date.now() - (range === "week" ? 7 : 30) * 86400000;
  const keep = (d?: string | null) => !since || Boolean(d && new Date(d).getTime() >= since);
  const filtered = data
    ? {
        xp: data.xp.filter((x) => keep(x.created_at)),
        cases: data.cases.filter((x) => keep(x.completed_at)),
        quizzes: data.quizzes.filter((x) => keep(x.completed_at)),
        osces: data.osces.filter((x) => keep(x.completed_at)),
        reviews: data.reviews.filter((x) => keep(x.last_reviewed_at ?? x.created_at)),
      }
    : null;
  const studyMinutes = filtered
    ? Math.round(
        filtered.cases.reduce(
          (n, x) =>
            n + (new Date(x.completed_at!).getTime() - new Date(x.started_at).getTime()) / 60000,
          0,
        ) +
          filtered.quizzes.reduce(
            (n, x) =>
              n + (new Date(x.completed_at!).getTime() - new Date(x.started_at).getTime()) / 60000,
            0,
          ) +
          filtered.osces.reduce((n, x) => n + x.time_taken_seconds / 60, 0) +
          filtered.reviews.length * 0.25,
      )
    : 0;
  const accuracy = filtered?.quizzes.length
    ? Math.round(filtered.quizzes.reduce((n, x) => n + (x.score ?? 0), 0) / filtered.quizzes.length)
    : 0;
  async function toggleOptOut(v: boolean) {
    if (!student) return;
    setOptedOut(v);
    if (v) await supabase.from("leaderboard_opt_outs").insert({ student_id: student.id });
    else await supabase.from("leaderboard_opt_outs").delete().eq("student_id", student.id);
  }
  if (!student || !data)
    return (
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="clay-card h-56 animate-pulse bg-lavender-soft" />
        <div className="clay-card h-56 animate-pulse bg-card" />
      </div>
    );
  const earnedMap = new Map(data.earned.map((x) => [x.achievement_id, x.earned_at]));
  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto">
          {(["overview", "achievements", "saved", "notes"] as const).map((x) => (
            <Button
              key={x}
              size="sm"
              variant={tab === x ? "lavender" : "secondary"}
              onClick={() => setTab(x)}
              className="capitalize"
            >
              {x}
            </Button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {(["week", "month", "all"] as const).map((x) => (
              <button
                key={x}
                onClick={() => setRange(x)}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${range === x ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                {x === "all" ? "All time" : `This ${x}`}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === "overview" && (
        <>
          <div className="grid gap-4 md:grid-cols-[1.35fr_.65fr]">
            <XpLevelCard student={student} />
            <div className="clay-card flex items-center justify-around bg-yellow-soft p-5">
              <div className="text-center">
                <Flame className="mx-auto text-pink" />
                <p className="font-display text-3xl font-black">{student.streak_days}</p>
                <p className="text-xs font-bold">day streak</p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div className="text-center">
                <Trophy className="mx-auto" />
                <p className="font-display text-3xl font-black">{student.longest_streak}</p>
                <p className="text-xs font-bold">personal best</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                "XP earned",
                filtered!.xp.reduce((n, x) => n + x.xp_amount, 0),
                Sparkles,
                "bg-lavender-soft",
              ],
              ["Cases", filtered!.cases.length, HeartPulse, "bg-lavender-soft"],
              ["Quizzes", filtered!.quizzes.length, Brain, "bg-blue-soft"],
              ["OSCEs", filtered!.osces.length, Stethoscope, "bg-pink-soft"],
              ["Cards reviewed", filtered!.reviews.length, Layers3, "bg-yellow-soft"],
              ["Quiz accuracy", `${accuracy}%`, Target, "bg-mint-soft"],
              [
                "Study time",
                `${Math.floor(studyMinutes / 60)}h ${studyMinutes % 60}m`,
                Clock3,
                "bg-card",
              ],
              [
                "Challenges",
                data.challenges.filter((x) => keep(x.created_at)).length,
                Trophy,
                "bg-yellow-soft",
              ],
            ].map(([label, value, Icon, color]) => (
              <div key={String(label)} className={`clay-card ${color} p-4`}>
                <Icon className="size-5" />
                <p className="mt-3 font-display text-2xl font-black">{String(value)}</p>
                <p className="text-xs font-bold text-ink-soft">{String(label)}</p>
              </div>
            ))}
          </div>
          <MasteryMap rows={data.mastery} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="clay-card bg-card p-5">
              <h3 className="font-display text-xl font-black">Recent achievements</h3>
              <div className="mt-4 space-y-3">
                {data.earned
                  .slice(-3)
                  .reverse()
                  .map((e) => {
                    const a = data.achievements.find((x) => x.id === e.achievement_id);
                    return (
                      a && (
                        <div key={a.id} className="flex items-center gap-3">
                          <span className="flex size-11 items-center justify-center rounded-2xl bg-yellow-soft text-2xl">
                            {a.icon}
                          </span>
                          <div>
                            <p className="text-sm font-extrabold">{a.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(e.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )
                    );
                  })}
              </div>
            </div>
            <div className="clay-card bg-mint-soft p-5">
              <h3 className="font-display text-xl font-black">Challenge history</h3>
              <div className="mt-4 space-y-3">
                {data.challenges.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-2xl bg-card/70 p-3"
                  >
                    <div>
                      <p className="text-sm font-extrabold">Weekly clinical challenge</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-yellow-soft px-3 py-1 text-xs font-black">
                      {c.score}% · #{c.rank ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="clay-card flex flex-wrap items-center justify-between gap-4 bg-card p-5">
            <div>
              <p className="font-extrabold">Public leaderboards</p>
              <p className="text-sm text-muted-foreground">
                Opt out any time. Your learning progress stays private to this demo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="yellow" size="sm" asChild>
                <Link to="/leaderboards">
                  <Medal /> View boards
                </Link>
              </Button>
              <Switch checked={!optedOut} onCheckedChange={(v) => toggleOptOut(!v)} />
            </div>
          </div>
        </>
      )}
      {tab === "achievements" && (
        <div>
          <div className="mb-5">
            <h2 className="font-display text-2xl font-black">Achievement gallery</h2>
            <p className="text-sm text-muted-foreground">
              {data.earned.length} of {data.achievements.length} earned
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.achievements.map((a) => {
              const earned = earnedMap.get(a.id);
              return (
                <div
                  key={a.id}
                  className={`clay-card p-5 ${earned ? "bg-yellow-soft" : "bg-muted opacity-70 grayscale"}`}
                >
                  <span
                    className={`flex size-16 items-center justify-center rounded-full text-3xl shadow-md ${earned ? "bg-yellow" : "bg-card"}`}
                  >
                    {earned ? a.icon : <Lock className="size-6" />}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-black">{a.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{a.description}</p>
                  <p className="mt-3 text-xs font-extrabold uppercase">
                    {earned ? `Earned ${new Date(earned).toLocaleDateString()}` : "Locked"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === "saved" && <SavedLibrary data={data} />}{" "}
      {tab === "notes" && <NotesLibrary data={data} setData={setData} />}{" "}
    </div>
  );
}

function MasteryMap({ rows }: { rows: Mastery[] }) {
  const systems = Array.from(new Set(rows.map((x) => x.subject_or_system)));
  return (
    <section className="clay-card bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-black">Mastery map</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Learning indicators based on recent practice — not certifications.
          </p>
        </div>
        <div className="flex gap-2 text-[10px] font-black">
          <span className="rounded-full bg-mint-soft px-2 py-1">STRONG</span>
          <span className="rounded-full bg-yellow-soft px-2 py-1">DEVELOPING</span>
          <span className="rounded-full bg-pink-soft px-2 py-1">WEAK</span>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {systems.map((system) => (
          <div key={system} className="rounded-[22px] bg-muted p-4">
            <h3 className="font-display font-black">{system}</h3>
            <div className="mt-3 space-y-2">
              {rows
                .filter((x) => x.subject_or_system === system)
                .map((x) => (
                  <div key={x.id}>
                    <div className="mb-1 flex justify-between text-xs font-bold">
                      <span>{x.competency}</span>
                      <span>{x.numeric_score}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-card">
                      <div
                        className={`h-full rounded-full ${x.level_label === "strong" ? "bg-mint" : x.level_label === "developing" ? "bg-yellow" : "bg-pink"}`}
                        style={{ width: `${x.numeric_score}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SavedLibrary({ data }: { data: DashboardData }) {
  const items = [
    ...data.saved.map((x) => ({
      id: x.id,
      type: x.content_type,
      title: x.title,
      href: x.related_link,
    })),
    ...data.questions.map((x) => ({
      id: x.id,
      type: "quiz question",
      title: x.quiz_questions?.question_text ?? "Saved question",
      href: "/quiz",
    })),
    ...data.decks.map((x) => ({
      id: x.id,
      type: "flashcard deck",
      title: x.flashcard_decks?.title ?? "Saved deck",
      href: "/flashcards",
    })),
  ];
  return (
    <div>
      <h2 className="font-display text-2xl font-black">Saved library</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cases, questions, stations, decks, and resources in one calm place.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((x) => (
          <a
            key={`${x.type}-${x.id}`}
            href={x.href}
            className="clay-card flex items-center gap-3 bg-card p-4"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-lavender-soft">
              <Bookmark className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground">{x.type}</p>
              <p className="truncate text-sm font-extrabold">{x.title}</p>
            </div>
            <ChevronRight className="size-4" />
          </a>
        ))}
      </div>
    </div>
  );
}
function NotesLibrary({
  data,
  setData,
}: {
  data: DashboardData;
  setData: Dispatch<SetStateAction<DashboardData | null>>;
}) {
  async function share(id: string, v: boolean) {
    await supabase.from("notes").update({ is_shared: v }).eq("id", id);
    setData((d) =>
      d ? { ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, is_shared: v } : n)) } : d,
    );
  }
  return (
    <div>
      <h2 className="font-display text-2xl font-black">Personal notes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Private by default. Choose individual notes to share.
      </p>
      <div className="mt-5 space-y-3">
        {data.notes.map((n) => (
          <div key={n.id} className="clay-card bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase">
                {n.content_type.replaceAll("_", " ")}
              </span>
              <label className="flex items-center gap-2 text-xs font-bold">
                Share <Switch checked={n.is_shared} onCheckedChange={(v) => share(n.id, v)} />
              </label>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{n.note_text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const boardTabs = [
  "Weekly",
  "Monthly",
  "Case-specific",
  "Friends",
  "Group",
  "Team",
  "University",
  "Year",
] as const;
export function Leaderboards({ student }: { student?: ActingStudent }) {
  const [tab, setTab] = useState<(typeof boardTabs)[number]>("Weekly");
  const [entries, setEntries] = useState<
    Array<{ id: string; name: string; detail: string; score: number; self?: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!student) return;
    (async () => {
      setLoading(true);
      const [students, xp, optouts, attempts, members, participants] = await Promise.all([
        supabase.from("students").select("id,name,university,year_of_study,xp"),
        supabase.from("xp_events").select("student_id,xp_amount,created_at"),
        supabase.from("leaderboard_opt_outs").select("student_id"),
        supabase
          .from("case_attempts")
          .select("student_id,total_score,completed_at")
          .eq("status", "completed"),
        supabase.from("group_members").select("group_id,student_id"),
        supabase
          .from("challenge_participants")
          .select("id,student_id,display_name,team_name,mode,score,rank"),
      ]);
      const excluded = new Set((optouts.data ?? []).map((x) => x.student_id));
      const people = (students.data ?? []).filter((s) => !excluded.has(s.id));
      let rows: Array<{ id: string; name: string; detail: string; score: number; self?: boolean }> =
        [];
      if (tab === "Team")
        rows = (participants.data ?? [])
          .filter((x) => x.mode === "team")
          .map((x) => ({
            id: x.id,
            name: x.team_name ?? x.display_name,
            detail: "Challenge team",
            score: x.score,
          }));
      else if (tab === "Case-specific")
        rows = people.map((s) => ({
          id: s.id,
          name: s.name,
          detail: "Best clinical case",
          score: Math.max(
            0,
            ...(attempts.data ?? [])
              .filter((a) => a.student_id === s.id)
              .map((a) => a.total_score ?? 0),
          ),
          self: s.id === student.id,
        }));
      else {
        let pool = people;
        if (tab === "University") pool = pool.filter((s) => s.university === student.university);
        if (tab === "Year") pool = pool.filter((s) => s.year_of_study === student.year_of_study);
        if (tab === "Group") {
          const mine = new Set(
            (members.data ?? []).filter((m) => m.student_id === student.id).map((m) => m.group_id),
          );
          const ids = new Set(
            (members.data ?? []).filter((m) => mine.has(m.group_id)).map((m) => m.student_id),
          );
          pool = pool.filter((s) => ids.has(s.id));
        }
        if (tab === "Friends")
          pool = pool.filter(
            (s) => s.year_of_study === student.year_of_study || s.id === student.id,
          );
        const days = tab === "Weekly" ? 7 : tab === "Monthly" ? 30 : 0;
        rows = pool.map((s) => ({
          id: s.id,
          name: s.name,
          detail: `${s.university} · Year ${s.year_of_study}`,
          score: days
            ? (xp.data ?? [])
                .filter(
                  (x) =>
                    x.student_id === s.id &&
                    new Date(x.created_at).getTime() > Date.now() - days * 86400000,
                )
                .reduce((n, x) => n + x.xp_amount, 0)
            : s.xp,
          self: s.id === student.id,
        }));
      }
      setEntries(rows.sort((a, b) => b.score - a.score));
      setLoading(false);
    })();
  }, [student?.id, tab]);
  return (
    <div>
      <div className="clay-card relative overflow-hidden bg-yellow-soft p-6 md:p-9">
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-pink/20" />
        <Medal className="size-9" />
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-ink-soft">
          Friendly competition
        </p>
        <h1 className="mt-1 font-display text-3xl font-black md:text-5xl">Leaderboards</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Celebrate consistency, learn together, and opt out whenever you like.
        </p>
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {boardTabs.map((x) => (
          <Button
            key={x}
            size="sm"
            variant={tab === x ? "yellow" : "secondary"}
            onClick={() => setTab(x)}
            className="shrink-0"
          >
            {x}
          </Button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="clay-card h-64 animate-pulse bg-card" />
        ) : (
          entries.map((e, i) => (
            <div
              key={e.id}
              className={`clay-card flex items-center gap-4 p-4 ${i === 0 ? "bg-yellow-soft" : i === 1 ? "bg-blue-soft" : i === 2 ? "bg-pink-soft" : "bg-card"} ${e.self ? "ring-2 ring-lavender" : ""}`}
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-black ${i < 3 ? "bg-card shadow-sm" : "bg-muted"}`}
              >
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-black">
                  {e.name}
                  {e.self ? " · You" : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-black">{e.score.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  {tab === "Case-specific" || tab === "Team" ? "score" : "XP"}
                </p>
              </div>
            </div>
          ))
        )}
        {!loading && !entries.length && (
          <div className="clay-card bg-card p-10 text-center text-muted-foreground">
            No eligible entries in this view yet.
          </div>
        )}
      </div>
    </div>
  );
}
