import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  GraduationCap,
  MessageSquare,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { MessageComposer, MessageList } from "./usmle.index";
import {
  enrollInClass,
  getCoachPublic,
  getStudentThread,
  leaveReview,
  sendStudentMessage,
  unenroll,
  type CoachPublic,
  type UsmleMessage,
} from "@/features/usmle/usmle.functions";

export const Route = createFileRoute("/usmle/$coachId")({
  head: () => ({
    meta: [
      { title: "Coach | Medley" },
      { name: "description", content: "USMLE coach profile, classes, reviews and messaging." },
    ],
  }),
  component: CoachProfilePage,
});

type Tab = "classes" | "reviews" | "message";

function CoachProfilePage() {
  const { coachId } = Route.useParams();
  const { isCoach } = useAuth();
  const [data, setData] = useState<CoachPublic | null>(null);
  const [tab, setTab] = useState<Tab>("classes");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    getCoachPublic({ data: { coachId } })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load coach."));
  }, [coachId]);
  useEffect(() => {
    load();
  }, [load]);

  if (err) return <p className="clay-card bg-card p-6 text-sm font-bold">{err}</p>;
  if (!data) return <div className="clay-card h-48 w-full animate-pulse bg-mint-soft" />;

  const { coach, rating, reviews, classes, myReview, canMessage } = data;
  const isStudent = !isCoach;

  async function toggleEnroll(classId: string, enrolled: boolean) {
    try {
      if (enrolled) await unenroll({ data: { classId } });
      else await enrollInClass({ data: { classId } });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update enrollment.");
    }
  }

  const tabs: Tab[] =
    isStudent && canMessage ? ["classes", "reviews", "message"] : ["classes", "reviews"];

  return (
    <div className="space-y-5">
      <Link
        to="/usmle"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> USMLE Prep
      </Link>

      <div className="clay-card bg-mint-soft p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-mint font-display text-xl font-black">
            {coach.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black md:text-3xl">{coach.name}</h1>
            <p className="mt-1 text-ink-soft">{coach.headline || "USMLE coach"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow text-yellow" />
                {rating > 0 ? `${rating.toFixed(1)} (${reviews.length})` : "No reviews yet"}
              </span>
              {coach.availability && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-4 w-4" /> {coach.availability}
                </span>
              )}
            </div>
            {coach.expertise.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {coach.expertise.map((e) => (
                  <span key={e} className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {coach.bio && <p className="mt-4 text-sm leading-relaxed">{coach.bio}</p>}
        {coach.qualifications && (
          <div className="mt-4 rounded-2xl bg-card/70 p-4">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase text-ink-soft">
              <Award className="h-3.5 w-3.5" /> Qualifications
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
              {coach.qualifications}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "mint" : "secondary"}
            onClick={() => setTab(t)}
            className="shrink-0 capitalize"
          >
            {t === "message" ? (
              <>
                <MessageSquare /> Message
              </>
            ) : (
              t
            )}
          </Button>
        ))}
      </div>

      {tab === "classes" && (
        <div className="space-y-3">
          {classes.map((c) => (
            <div key={c.id} className="clay-card bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
                    {c.usmle_step}
                  </span>
                  <p className="mt-2 font-display text-lg font-black">{c.title}</p>
                  {c.description && <p className="text-sm text-ink-soft">{c.description}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-ink-soft">
                    {c.schedule && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> {c.schedule}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {c.enrolled}
                      {c.capacity != null && ` / ${c.capacity}`} enrolled
                    </span>
                  </p>
                </div>
                {isStudent && (
                  <Button
                    size="sm"
                    variant={c.isEnrolled ? "secondary" : "mint"}
                    className="shrink-0"
                    disabled={!c.isEnrolled && !c.is_open}
                    onClick={() => toggleEnroll(c.id, c.isEnrolled)}
                  >
                    {c.isEnrolled ? "Enrolled ✓" : c.is_open ? "Enroll" : "Closed"}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!classes.length && (
            <p className="text-sm text-muted-foreground">
              This coach hasn't published any classes yet.
            </p>
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-4">
          {isStudent && canMessage && (
            <ReviewForm coachId={coachId} myReview={myReview} onSaved={load} />
          )}
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="clay-card bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{r.student_name}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow text-yellow" : "text-border"}`}
                      />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-sm leading-relaxed">{r.comment}</p>}
              </div>
            ))}
            {!reviews.length && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
          </div>
        </div>
      )}

      {tab === "message" && isStudent && canMessage && (
        <StudentThread coachId={coachId} coachName={coach.name} />
      )}
    </div>
  );
}

function ReviewForm({
  coachId,
  myReview,
  onSaved,
}: {
  coachId: string;
  myReview: { rating: number; comment: string } | null;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(myReview?.rating ?? 5);
  const [comment, setComment] = useState(myReview?.comment ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await leaveReview({ data: { coachId, rating, comment: comment.trim() || undefined } });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="clay-card space-y-3 bg-mint-soft p-4">
      <p className="font-display text-lg font-black">
        {myReview ? "Update your review" : "Leave a review"}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i + 1)}
            aria-label={`${i + 1} stars`}
          >
            <Star className={`h-7 w-7 ${i < rating ? "fill-yellow text-yellow" : "text-border"}`} />
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded-2xl bg-card px-4 py-2.5 soft-inset"
        placeholder="Share how this coach helped your prep…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        rows={3}
      />
      <Button variant="mint" onClick={submit} disabled={busy}>
        {myReview ? "Update review" : "Post review"}
      </Button>
    </div>
  );
}

function StudentThread({ coachId, coachName }: { coachId: string; coachName: string }) {
  const [msgs, setMsgs] = useState<UsmleMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getStudentThread({ data: { coachId } }).then(setMsgs);
  }, [coachId]);
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
    const row = await sendStudentMessage({ data: { coachId, body: text.trim() } });
    if (row) setMsgs((p) => (p.some((x) => x.id === row.id) ? p : [...p, row]));
    setText("");
  }

  return (
    <div className="clay-card flex flex-col bg-card p-4">
      <p className="flex items-center gap-2 font-display text-lg font-black">
        <GraduationCap className="h-5 w-5" /> {coachName}
      </p>
      <MessageList msgs={msgs} mine="student" endRef={endRef} />
      <MessageComposer text={text} setText={setText} onSend={send} />
    </div>
  );
}
