import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Megaphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClassDetail, type ClassDetail } from "@/features/usmle/usmle.functions";

export const Route = createFileRoute("/usmle/class/$classId")({
  head: () => ({
    meta: [
      { title: "Class | Medley" },
      { name: "description", content: "Your USMLE class: classmates, schedule and announcements." },
    ],
  }),
  component: ClassDetailPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ClassDetailPage() {
  const { classId } = Route.useParams();
  const [data, setData] = useState<ClassDetail | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    getClassDetail({ data: { classId } })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load this class."));
  }, [classId]);
  useEffect(() => {
    load();
  }, [load]);

  if (err)
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="clay-card bg-card p-6 text-sm font-bold">{err}</p>
      </div>
    );
  if (!data) return <div className="clay-card h-48 w-full animate-pulse bg-mint-soft" />;

  const { class: cls, classmates, announcements } = data;

  return (
    <div className="space-y-5">
      <BackLink />

      {/* Hero */}
      <div className="clay-card overflow-hidden bg-gradient-to-br from-mint-soft to-accent p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-card px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
              {cls.usmle_step}
            </span>
            <h1 className="mt-3 font-display text-2xl font-black md:text-4xl">{cls.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-bold text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" /> with {cls.coach_name}
              </span>
              {cls.schedule && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" /> {cls.schedule}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {classmates.length}
                {cls.capacity != null && ` / ${cls.capacity}`} enrolled
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" className="bg-card" asChild>
              <Link to="/usmle/$coachId" params={{ coachId: cls.coach_id }}>
                View coach →
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Main column */}
        <div className="space-y-4">
          {cls.description && (
            <section className="clay-card bg-card p-5 md:p-6">
              <h2 className="font-display text-xl font-black">About this class</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {cls.description}
              </p>
            </section>
          )}

          <section className="clay-card bg-card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-black">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-lavender-soft">
                  <Megaphone className="h-5 w-5" />
                </span>
                Announcements
              </h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-ink-soft">
                {announcements.length}
              </span>
            </div>

            {announcements.length ? (
              <ul className="mt-4 space-y-3">
                {announcements.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-muted/70 p-4">
                    <p className="text-sm leading-relaxed">{a.body}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
                      <GraduationCap className="h-3.5 w-3.5" /> {cls.coach_name} ·{" "}
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
            ) : (
              <div className="mt-4 grid place-items-center rounded-2xl bg-muted/60 px-4 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-2xl">
                  📣
                </span>
                <p className="mt-3 font-display font-black">No announcements yet</p>
                <p className="mt-1 max-w-xs text-sm text-ink-soft">
                  Your coach's updates and reminders will appear here when they're posted.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Classmates */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="clay-card bg-mint-soft p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-black">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-card">
                  <Users className="h-5 w-5" />
                </span>
                Classmates
              </h2>
              <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-ink-soft">
                {classmates.length} {classmates.length === 1 ? "student" : "students"}
              </span>
            </div>

            {classmates.length ? (
              <ul className="mt-4 space-y-2">
                {classmates.map((m) => (
                  <li
                    key={m.student_id}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-black">
                      {initials(m.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
                    {m.is_self && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-black text-ink-soft">
                        <BadgeCheck className="h-3.5 w-3.5" /> You
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl bg-card p-4 text-sm text-ink-soft">
                No students have enrolled yet.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/usmle"
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> USMLE Prep
    </Link>
  );
}
