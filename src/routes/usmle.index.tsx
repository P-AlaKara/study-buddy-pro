import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Megaphone,
  Plus,
  Search,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import {
  createClass,
  deleteClass,
  enrollInClass,
  getCoachDashboard,
  getCoachThread,
  getStudentHome,
  listCoaches,
  sendAnnouncement,
  sendCoachMessage,
  updateClass,
  updateCoachProfile,
  type CoachDashboard,
  type CoachListItem,
  type MyEnrollment,
  type ClassAnnouncement,
  type UsmleMessage,
} from "@/features/usmle/usmle.functions";

export const Route = createFileRoute("/usmle/")({
  head: () => ({
    meta: [
      { title: "USMLE Prep | Medley" },
      {
        name: "description",
        content: "Find USMLE coaches, enroll in prep classes, and message your coach.",
      },
      { property: "og:title", content: "USMLE Prep | Medley" },
      {
        property: "og:description",
        content: "Find USMLE coaches, enroll in prep classes, and message your coach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsmleHome,
});

function UsmleHome() {
  const { isCoach } = useAuth();
  return isCoach ? <CoachDashboardView /> : <StudentDiscovery />;
}

function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-extrabold">
      <Star className="h-4 w-4 fill-yellow text-yellow" />
      {rating > 0 ? rating.toFixed(1) : "New"}
      {count != null && count > 0 && (
        <span className="text-xs font-bold text-ink-soft">({count})</span>
      )}
    </span>
  );
}

// ===========================================================================
// STUDENT: discovery
// ===========================================================================
function StudentDiscovery() {
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCoaches(), getStudentHome()])
      .then(([cs, home]) => {
        setCoaches(cs);
        setEnrollments(home.enrollments);
        setAnnouncements(home.announcements);
      })
      .finally(() => setLoading(false));
  }, []);

  const term = query.trim().toLowerCase();
  const filtered = term
    ? coaches.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.headline.toLowerCase().includes(term) ||
          c.expertise.some((e) => e.toLowerCase().includes(term)),
      )
    : coaches;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="clay-card overflow-hidden bg-gradient-to-br from-mint-soft to-accent p-6 md:p-8">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-mint">
              <GraduationCap className="h-4 w-4" /> USMLE PREP
            </p>
            <h1 className="mt-2 font-display text-3xl font-black md:text-5xl">
              Prepare for the USMLE
            </h1>
            <p className="mt-3 max-w-xl text-sm text-ink-soft md:text-base">
              Learn from experienced coaches, join structured classes, and get guidance for your
              Step exams.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Structured classes", "Expert guidance", "Direct messaging"].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-card/80 px-3 py-1.5 text-[11px] font-black text-ink-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <span className="hidden size-28 shrink-0 place-items-center rounded-[28px] bg-card/70 text-6xl shadow-[inset_0_2px_1px_var(--card)] md:grid">
            🩺
          </span>
        </div>
      </div>

      {enrollments.length > 0 && (
        <section>
          <SectionTitle icon="📚" title="My classes" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {enrollments.map((e) => (
              <Link
                key={e.class_id}
                to="/usmle/class/$classId"
                params={{ classId: e.class_id }}
                className="clay-card flex items-start gap-4 bg-card p-5"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-2xl shadow-[inset_0_2px_1px_var(--card)]">
                  🎓
                </span>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
                    {e.usmle_step}
                  </span>
                  <p className="mt-2 font-display text-lg font-black leading-snug">
                    {e.class_title}
                  </p>
                  <p className="text-sm text-ink-soft">with {e.coach_name}</p>
                  {e.schedule && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                      <CalendarClock className="h-3.5 w-3.5" /> {e.schedule}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="clay-card bg-lavender-soft p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-black">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-card">
              <Megaphone className="h-5 w-5" />
            </span>
            Announcements
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {announcements.slice(0, 6).map((a) => (
              <li key={a.id} className="rounded-2xl bg-card p-4">
                <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                  {a.class_title}
                </p>
                <p className="mt-1 text-sm leading-relaxed">{a.body}</p>
                <p className="mt-2 text-[10px] font-bold text-ink-soft">
                  {new Date(a.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon="🧑‍🏫" title="Browse coaches" />
          <label className="flex items-center gap-2 rounded-full bg-card px-4 py-2 soft-inset">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or expertise…"
              className="min-w-0 bg-transparent text-sm font-bold outline-none"
            />
          </label>
        </div>
        {loading ? (
          <div className="mt-4 clay-card h-40 w-full animate-pulse bg-mint-soft" />
        ) : filtered.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <CoachCard key={c.id} coach={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🔎"
            title={term ? "No coaches found" : "No coaches yet"}
            body={
              term
                ? "No coaches match your search or filters. Try a different name or specialty."
                : "Coaches will appear here as they join Medley."
            }
          />
        )}
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-xl font-black md:text-2xl">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-mint-soft text-xl shadow-[inset_0_2px_1px_var(--card)]">
        {icon}
      </span>
      {title}
    </h2>
  );
}

function CoachCard({ coach }: { coach: CoachListItem }) {
  return (
    <Link
      to="/usmle/$coachId"
      params={{ coachId: coach.id }}
      className="clay-card flex flex-col bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-mint font-display text-lg font-black">
          {initials(coach.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-lg font-black leading-tight">{coach.name}</p>
            <Stars rating={coach.rating} count={coach.reviews} />
          </div>
          <p className="line-clamp-2 text-sm text-ink-soft">{coach.headline || "USMLE coach"}</p>
        </div>
      </div>
      {coach.expertise.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {coach.expertise.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-bold">
              {e}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <span className="text-xs font-bold text-ink-soft">
          {coach.classes} open {coach.classes === 1 ? "class" : "classes"}
        </span>
        <span className="text-sm font-extrabold text-mint">View profile →</span>
      </div>
    </Link>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="clay-card mt-4 grid place-items-center bg-card px-6 py-14 text-center">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-mint-soft text-4xl shadow-[inset_0_2px_1px_var(--card)]">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-2xl font-black">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

// ===========================================================================
// COACH: dashboard
// ===========================================================================
type CoachTab = "classes" | "messages" | "profile";

function CoachDashboardView() {
  const [data, setData] = useState<CoachDashboard | null>(null);
  const [tab, setTab] = useState<CoachTab>("classes");

  const load = useCallback(() => getCoachDashboard().then(setData), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="clay-card h-48 w-full animate-pulse bg-mint-soft" />;

  const totalStudents = new Set(data.classes.flatMap((c) => c.enrollments.map((e) => e.student_id)))
    .size;

  return (
    <div className="space-y-5">
      <div className="clay-card overflow-hidden bg-gradient-to-br from-mint-soft to-accent p-6 md:p-7">
        <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-mint">
          <GraduationCap className="h-4 w-4" /> COACH DASHBOARD
        </p>
        <h1 className="mt-2 font-display text-2xl font-black md:text-4xl">
          Welcome, {data.coach.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            `${data.classes.length} ${data.classes.length === 1 ? "class" : "classes"}`,
            `${totalStudents} ${totalStudents === 1 ? "student" : "students"}`,
            `${data.threads.length} ${data.threads.length === 1 ? "conversation" : "conversations"}`,
          ].map((t) => (
            <span
              key={t}
              className="rounded-full bg-card/80 px-3 py-1.5 text-[11px] font-black text-ink-soft"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["classes", "messages", "profile"] as CoachTab[]).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "mint" : "secondary"}
            onClick={() => setTab(t)}
            className="shrink-0 capitalize"
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "classes" && <CoachClasses data={data} reload={load} />}
      {tab === "messages" && <CoachMessages data={data} />}
      {tab === "profile" && <CoachProfileEditor data={data} reload={load} />}
    </div>
  );
}

const STEPS = ["Step 1", "Step 2 CK", "Step 3"] as const;
const emptyClassForm = {
  title: "",
  description: "",
  usmle_step: "Step 1" as (typeof STEPS)[number],
  schedule: "",
  capacity: "",
};

function CoachClasses({ data, reload }: { data: CoachDashboard; reload: () => Promise<void> }) {
  const [form, setForm] = useState(emptyClassForm);
  const [creating, setCreating] = useState(false);
  const [announce, setAnnounce] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function create() {
    if (form.title.trim().length < 2) return;
    try {
      await createClass({
        data: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          usmle_step: form.usmle_step,
          schedule: form.schedule.trim() || undefined,
          capacity: form.capacity ? Number(form.capacity) : null,
        },
      });
      setForm(emptyClassForm);
      setCreating(false);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create class.");
    }
  }
  async function remove(classId: string) {
    await deleteClass({ data: { classId } });
    await reload();
  }
  async function toggleOpen(classId: string, isOpen: boolean) {
    await updateClass({ data: { classId, is_open: !isOpen } });
    await reload();
  }
  async function broadcast(classId: string) {
    const body = (announce[classId] ?? "").trim();
    if (!body) return;
    await sendAnnouncement({ data: { classId, body } });
    setAnnounce((p) => ({ ...p, [classId]: "" }));
    setMsg("Announcement sent to all enrolled students.");
  }

  return (
    <div className="space-y-4">
      <div className="clay-card bg-card p-5">
        {!creating ? (
          <Button variant="mint" onClick={() => setCreating(true)}>
            <Plus /> New class
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="font-display text-lg font-black">Create a class</p>
            <input
              className="w-full rounded-2xl bg-muted px-4 py-2.5 soft-inset"
              placeholder="Class title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={160}
            />
            <textarea
              className="w-full rounded-2xl bg-muted px-4 py-2.5 soft-inset"
              placeholder="What will students learn?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-full bg-muted px-4 py-2 font-bold soft-inset"
                value={form.usmle_step}
                onChange={(e) =>
                  setForm({ ...form, usmle_step: e.target.value as (typeof STEPS)[number] })
                }
              >
                {STEPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2 soft-inset"
                placeholder="Schedule e.g. Mon & Wed 7pm EST"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                maxLength={1000}
              />
              <input
                className="w-28 rounded-full bg-muted px-4 py-2 soft-inset"
                placeholder="Max"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="mint" onClick={create} disabled={form.title.trim().length < 2}>
                Create class
              </Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
      </div>

      {data.classes.map((c) => (
        <div key={c.id} className="clay-card bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
                {c.usmle_step}
              </span>
              <p className="mt-2 font-display text-lg font-black">{c.title}</p>
              {c.description && <p className="text-sm text-ink-soft">{c.description}</p>}
              <p className="mt-1 text-xs font-bold text-ink-soft">
                {c.schedule || "No schedule set"}
                {c.capacity != null && ` · cap ${c.capacity}`}
              </p>
              <Link
                to="/usmle/class/$classId"
                params={{ classId: c.id }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-mint"
              >
                Open class page →
              </Link>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Button
                size="sm"
                variant={c.is_open ? "mint" : "secondary"}
                onClick={() => toggleOpen(c.id, c.is_open)}
              >
                {c.is_open ? "Open" : "Closed"}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label="Delete class"
                onClick={() => remove(c.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase text-ink-soft">
              <Users className="h-3.5 w-3.5" /> Enrolled ({c.enrollments.length})
            </p>
            {c.enrollments.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.enrollments.map((e) => (
                  <span
                    key={e.student_id}
                    className="rounded-full bg-card px-3 py-1 text-xs font-bold"
                  >
                    {e.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-soft">No students yet.</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 soft-inset"
              placeholder="Announce to the whole class…"
              value={announce[c.id] ?? ""}
              onChange={(e) => setAnnounce((p) => ({ ...p, [c.id]: e.target.value }))}
              maxLength={4000}
            />
            <Button variant="blue" onClick={() => broadcast(c.id)}>
              <Megaphone /> Send
            </Button>
          </div>
        </div>
      ))}
      {!data.classes.length && (
        <p className="text-sm text-muted-foreground">
          You haven't created any classes yet. Start with "New class" above.
        </p>
      )}
    </div>
  );
}

function CoachMessages({ data }: { data: CoachDashboard }) {
  const [active, setActive] = useState<string | null>(data.threads[0]?.student_id ?? null);
  // A coach can message any enrolled student, even before a thread exists.
  const students = dedupeStudents(data);
  const activeName = students.find((s) => s.student_id === active)?.name ?? "Student";

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="clay-card bg-card p-3">
        <p className="px-2 py-1 text-xs font-black uppercase text-ink-soft">Students</p>
        {students.length ? (
          <ul className="space-y-1">
            {students.map((s) => (
              <li key={s.student_id}>
                <button
                  onClick={() => setActive(s.student_id)}
                  className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-bold ${
                    active === s.student_id ? "bg-mint" : "hover:bg-muted"
                  }`}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-3 text-xs text-ink-soft">
            Students who enroll in your classes appear here.
          </p>
        )}
      </div>
      {active ? (
        <CoachThread key={active} studentId={active} studentName={activeName} />
      ) : (
        <div className="clay-card grid min-h-48 place-items-center bg-card p-5 text-sm text-ink-soft">
          Select a student to start a conversation.
        </div>
      )}
    </div>
  );
}

function dedupeStudents(data: CoachDashboard): { student_id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const t of data.threads) map.set(t.student_id, t.name);
  for (const c of data.classes)
    for (const e of c.enrollments) if (!map.has(e.student_id)) map.set(e.student_id, e.name);
  return [...map.entries()].map(([student_id, name]) => ({ student_id, name }));
}

function CoachThread({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [msgs, setMsgs] = useState<UsmleMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getCoachThread({ data: { studentId } }).then(setMsgs);
  }, [studentId]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send() {
    if (!text.trim()) return;
    const row = await sendCoachMessage({ data: { studentId, body: text.trim() } });
    if (row) setMsgs((p) => (p.some((x) => x.id === row.id) ? p : [...p, row]));
    setText("");
  }

  return (
    <div className="clay-card flex flex-col bg-card p-4">
      <p className="font-display text-lg font-black">{studentName}</p>
      <MessageList msgs={msgs} mine="coach" endRef={endRef} />
      <MessageComposer text={text} setText={setText} onSend={send} />
    </div>
  );
}

function CoachProfileEditor({
  data,
  reload,
}: {
  data: CoachDashboard;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: data.coach.name,
    headline: data.coach.headline,
    bio: data.coach.bio,
    qualifications: data.coach.qualifications,
    availability: data.coach.availability,
    expertise: data.coach.expertise.join(", "),
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    await updateCoachProfile({
      data: {
        name: form.name.trim(),
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        qualifications: form.qualifications.trim(),
        availability: form.availability.trim(),
        expertise: form.expertise
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 30),
      },
    });
    setSaved(true);
    await reload();
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="clay-card space-y-3 bg-card p-5">
      <p className="font-display text-lg font-black">Your public profile</p>
      <LabeledInput
        label="Name"
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
      />
      <LabeledInput
        label="Headline"
        value={form.headline}
        placeholder="e.g. Step 1 high-yield specialist · 99th percentile"
        onChange={(v) => setForm({ ...form, headline: v })}
      />
      <LabeledTextarea
        label="Bio"
        value={form.bio}
        placeholder="Tell students about your background and teaching style."
        onChange={(v) => setForm({ ...form, bio: v })}
      />
      <LabeledTextarea
        label="Qualifications"
        value={form.qualifications}
        placeholder="Degrees, scores, teaching experience."
        onChange={(v) => setForm({ ...form, qualifications: v })}
      />
      <LabeledInput
        label="Areas of expertise (comma separated)"
        value={form.expertise}
        placeholder="Pharmacology, Pathology, Cardiology"
        onChange={(v) => setForm({ ...form, expertise: v })}
      />
      <LabeledInput
        label="Availability"
        value={form.availability}
        placeholder="e.g. Weekday evenings, EST"
        onChange={(v) => setForm({ ...form, availability: v })}
      />
      <div className="flex items-center gap-3">
        <Button variant="mint" onClick={save} disabled={form.name.trim().length < 2}>
          Save profile
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-bold text-mint">
            <BadgeCheck className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

// --- Shared message UI (also used on the coach profile page) ---------------
export function MessageList({
  msgs,
  mine,
  endRef,
}: {
  msgs: UsmleMessage[];
  mine: "coach" | "student";
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="my-3 max-h-[46vh] min-h-32 flex-1 space-y-3 overflow-y-auto p-1">
      {msgs.map((m) => {
        const isMine = m.sender_role === mine;
        return (
          <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-3xl px-4 py-2 ${isMine ? "bg-mint" : "bg-muted"}`}>
              <p className="text-sm leading-relaxed">{m.body}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">
                {new Date(m.created_at).toLocaleString([], {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
      {!msgs.length && (
        <p className="grid h-full place-items-center text-sm text-ink-soft">
          No messages yet. Say hello!
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}

export function MessageComposer({
  text,
  setText,
  onSend,
  placeholder = "Type a message…",
}: {
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        className="min-w-0 flex-1 rounded-full bg-muted px-4 py-3 soft-inset"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        maxLength={4000}
      />
      <Button variant="mint" size="icon" aria-label="Send" onClick={onSend}>
        <Send />
      </Button>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-extrabold uppercase text-ink-soft">{label}</span>
      <input
        className="w-full rounded-2xl bg-muted px-4 py-2.5 soft-inset"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-extrabold uppercase text-ink-soft">{label}</span>
      <textarea
        className="w-full rounded-2xl bg-muted px-4 py-2.5 soft-inset"
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
