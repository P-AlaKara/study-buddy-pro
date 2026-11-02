import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  BookOpenText,
  Brain,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Flame,
  GraduationCap,
  HeartPulse,
  Home,
  Layers3,
  LogOut,
  Medal,
  PersonStanding,
  Sparkles,
  Stethoscope,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/features/auth/auth-context";
import type { CoachProfile } from "@/features/usmle/usmle.functions";
import {
  CelebrationLayer,
  HomeGamification,
  ProgressDashboard,
  StudentUtilities,
} from "@/components/gamification";
import { DR_AMBROSE, DrAmbrose } from "@/features/case-challenge/components/dr-ambrose";
import { PatientAvatar } from "@/features/case-challenge/components/patient-avatar";
import { FEATURED_CASE } from "@/features/case-challenge/featured-case";
import { STUDY_WITH_ANNIE_ENABLED } from "@/features/study-with-annie/feature-flag";
import { ANATOMY_LAB_ENABLED } from "@/features/anatomy-lab/feature-flag";

type Student = Pick<
  Database["public"]["Tables"]["students"]["Row"],
  | "id"
  | "name"
  | "email"
  | "university"
  | "country"
  | "year_of_study"
  | "medical_program"
  | "current_level"
  | "subjects_studying"
  | "current_rotation"
  | "specialty_interests"
  | "weak_areas"
  | "study_goal"
  | "daily_study_target_minutes"
  | "notification_prefs"
  | "xp"
  | "level"
  | "streak_days"
  | "longest_streak"
  | "created_at"
>;
type View = "home" | "cases" | "practice" | "usmle" | "profile" | "leaderboards";
type PracticeTab = "OSCE" | "Quizzes" | "Flashcards";
type NavItem = { key: View | "misc"; label: string; to: string; icon: typeof Home };
// Students get the full study shell; coaches only need their coaching space and
// their profile.
const studentNav: NavItem[] = [
  { key: "home", label: "Home", to: "/", icon: Home },
  ...(STUDY_WITH_ANNIE_ENABLED
    ? [{ key: "misc" as const, label: "AI Study", to: "/study-with-annie", icon: BookOpenText }]
    : []),
  { key: "cases", label: "Cases", to: "/cases", icon: HeartPulse },
  ...(ANATOMY_LAB_ENABLED
    ? [{ key: "misc" as const, label: "Anatomy", to: "/anatomy", icon: PersonStanding }]
    : []),
  { key: "practice", label: "Practice", to: "/practice", icon: Stethoscope },
  { key: "usmle", label: "USMLE Prep", to: "/usmle", icon: GraduationCap },
  { key: "profile", label: "Profile", to: "/profile", icon: Activity },
];
const coachNav: NavItem[] = [
  { key: "usmle", label: "USMLE Prep", to: "/usmle", icon: GraduationCap },
  { key: "profile", label: "Profile", to: "/profile", icon: Activity },
];
const FEATURED_CASE_AVATAR_SIZE = "!w-14 sm:!w-20";
const subjects = [
  "Anatomy",
  "Biochemistry",
  "Clinical Skills",
  "Internal Medicine",
  "Microbiology",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Pathology",
  "Pharmacology",
  "Physiology",
  "Public Health",
  "Surgery",
];
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const firstName = (name?: string) => name?.split(" ")[0] ?? "student";

function IconBubble({ icon: Icon, color = "lavender" }: { icon: typeof Home; color?: string }) {
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-${color}-soft text-foreground shadow-[inset_0_2px_1px_var(--card)]`}
    >
      <Icon size={21} strokeWidth={2.2} />
    </span>
  );
}
function SectionHeading({
  title,
  action,
  to,
}: {
  title: string;
  action?: string;
  to?: "/cases" | "/practice" | "/usmle";
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-black md:text-2xl">{title}</h2>
      {action && to && (
        <Link
          to={to}
          className="flex items-center gap-1 text-sm font-extrabold text-ink-soft hover:text-foreground"
        >
          {action}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
function EmptyAction({ label }: { label: string }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{label}</p>;
}

export type ActingStudent = Student;
const StudentContext = createContext<Student | undefined>(undefined);
export const useActingStudent = () => useContext(StudentContext);

export function StudyApp({ view, children }: { view: View; children?: ReactNode }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { profile, isCoach, isLoading: loading, signOut, refresh } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [practiceTab, setPracticeTab] = useState<PracticeTab>("OSCE");
  const [activity, setActivity] = useState<string | null>(null);
  // Each account owns exactly one profile; it comes from the auth context.
  const student = profile as Student | undefined;
  const coach = isCoach ? (profile as unknown as CoachProfile | undefined) : undefined;
  const navItems = isCoach ? coachNav : studentNav;

  // Coaches only have a coaching space; keep them out of the student-only views.
  useEffect(() => {
    if (isCoach && view !== "usmle" && view !== "profile") {
      void navigate({ to: "/usmle" });
    }
  }, [isCoach, view, navigate]);

  // Keep XP / streak fresh when the tab regains focus.
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    await navigate({ to: "/login" });
  };
  // Coach profiles don't carry these student-only arrays, so guard every access
  // (the shell header renders for both roles before the coach redirect fires).
  const personalizedSubjects = student?.subjects_studying?.length
    ? student.subjects_studying
    : ["Internal Medicine", "Pharmacology"];
  const weakAreas = student?.weak_areas?.length
    ? student.weak_areas
    : ["Pharmacology", "Clinical Skills"];
  const minutes = student?.daily_study_target_minutes ?? 30;
  const recommendations = [
    {
      type: "CASE",
      title: `${personalizedSubjects[0]}: clinical reasoning`,
      description: "Work through a patient presentation",
      icon: HeartPulse,
      color: "lavender",
      tab: "Cases",
    },
    {
      type: "QUIZ",
      title: `${weakAreas[0]} essentials`,
      description: "10 quick questions · 8 min",
      icon: Brain,
      color: "blue",
      tab: "Quizzes",
    },
    {
      type: "OSCE",
      title: "Focused history taking",
      description: "History taking · 8 min",
      icon: Stethoscope,
      color: "pink",
      tab: "OSCE",
    },
    {
      type: "DECK",
      title: `${personalizedSubjects.at(-1)} quick recall`,
      description: "Review 18 high-yield cards",
      icon: Layers3,
      color: "yellow",
      tab: "Flashcards",
    },
  ];

  return (
    <div className="app-shell pb-28 lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:border-b-0 lg:bg-background/95 lg:backdrop-blur-sm">
        <div className="app-container flex items-center justify-between gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 md:py-5">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 font-display text-[26px] font-black text-foreground"
            aria-label="Medley home"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-pink text-foreground shadow-sm">
              <HeartPulse size={23} strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">
              medley<span className="text-pink">.</span>
            </span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`rounded-full px-4 py-2 text-sm font-extrabold transition-colors ${view === item.key ? "bg-lavender-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <StudentUtilities student={student} />
            <div className="relative min-w-0">
              <Button
                variant="secondary"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="h-11 max-w-[190px] gap-2 bg-card px-2 pr-3 shadow-sm hover:bg-card md:max-w-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-black">
                  {student ? initials(student.name) : "?"}
                </span>
                <span className="min-w-0 truncate text-left text-xs md:text-sm">
                  <span className="block text-[10px] font-bold leading-none text-muted-foreground">
                    SIGNED IN
                  </span>
                  {loading ? "Loading..." : firstName(student?.name)}
                </span>
                <ChevronDown size={15} className="shrink-0" />
              </Button>
              {menuOpen &&
                (() => {
                  const menuContent = (
                    <>
                      <div className="px-3 pb-2 pt-2">
                        <p className="truncate text-sm font-extrabold">{student?.name}</p>
                        <p className="truncate text-xs font-medium text-muted-foreground">
                          {student?.email}
                        </p>
                      </div>
                      <div className="my-1 h-px bg-border" />
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setMenuOpen(false);
                          void navigate({ to: "/profile" });
                        }}
                        className="w-full justify-start gap-3 rounded-2xl px-3 py-3 text-sm md:py-2"
                      >
                        <Activity size={18} />
                        Your profile
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start gap-3 rounded-2xl px-3 py-3 text-sm text-red-600 md:py-2"
                      >
                        <LogOut size={18} />
                        Sign out
                      </Button>
                    </>
                  );
                  return isMobile ? (
                    <div
                      className="sheet-scrim fixed inset-0 z-50 flex items-end bg-foreground/30 backdrop-blur-sm"
                      onClick={() => setMenuOpen(false)}
                    >
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Account menu"
                        className="mobile-sheet max-h-[75dvh] w-full overflow-y-auto rounded-t-[28px] bg-card p-3 pt-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-border" />
                        {menuContent}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-14 z-40 w-[min(85vw,290px)] rounded-[22px] bg-card p-2 shadow-xl">
                        {menuContent}
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      </header>
      <main className="app-container pt-6 md:pt-8">
        {view === "home" && (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink-soft">
                  <Sparkles size={16} className="text-pink" /> YOUR STUDY SPACE
                </p>
                <h1 className="font-display text-3xl font-black leading-tight md:text-5xl">
                  Good to see you, {firstName(student?.name)}
                </h1>
                <p className="mt-2 text-base text-muted-foreground md:text-lg">
                  What should I study today?
                </p>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-yellow-soft px-4 py-2 text-sm font-extrabold md:flex">
                <Flame size={18} className="text-pink" />
                {student?.streak_days ?? 0} day streak
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <div className="space-y-6">
                <section className="clay-card overflow-hidden bg-lavender-soft p-5 md:p-6">
                  <span className="inline-flex rounded-full bg-card/75 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
                    ✦ Weekly case
                  </span>
                  <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-5">
                    <PatientAvatar
                      patient={FEATURED_CASE.patient}
                      expression={FEATURED_CASE.patient.initialExpression}
                      respiratoryRate={FEATURED_CASE.vitalsTimeline[0]?.rr ?? 16}
                      decorative
                      className={`${FEATURED_CASE_AVATAR_SIZE} mx-0 shrink-0`}
                    />
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">
                        {FEATURED_CASE.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft md:text-base">
                        {FEATURED_CASE.intro}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink-soft sm:text-xs">
                        <span className="rounded-full bg-card/70 px-2.5 py-1">
                          Level {FEATURED_CASE.difficulty}
                        </span>
                        {FEATURED_CASE.specialty.map((specialty) => (
                          <span key={specialty} className="rounded-full bg-card/70 px-2.5 py-1">
                            {specialty}
                          </span>
                        ))}
                      </div>
                      <Button
                        variant="lavender"
                        className="mt-4"
                        aria-label={`Start case: ${FEATURED_CASE.title}`}
                        onClick={() =>
                          navigate({
                            to: "/cases/$caseId",
                            params: { caseId: FEATURED_CASE.id },
                          })
                        }
                      >
                        Start case <ArrowRight size={17} />
                      </Button>
                    </div>
                  </div>
                </section>
                <section>
                  <SectionHeading title="Pick up where you left off" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      onClick={() => navigate({ to: "/cases" })}
                      className="clay-card flex w-full items-center gap-4 bg-card p-5 text-left"
                    >
                      <IconBubble icon={HeartPulse} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase text-muted-foreground">
                          Case · In progress
                        </p>
                        <h3 className="mt-1 truncate font-display font-black">
                          Chest pain assessment
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">About 10 min remaining</p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() =>
                        setActivity("Your quiz sessions will appear here in a later step.")
                      }
                      className="clay-card flex w-full items-center gap-4 bg-card p-5 text-left"
                    >
                      <IconBubble icon={Brain} color="blue" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase text-muted-foreground">
                          Quiz · In progress
                        </p>
                        <h3 className="mt-1 truncate font-display font-black">
                          {weakAreas[0]} review
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">Question 6 of 10</p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </section>
                <section>
                  <SectionHeading
                    title="Recommended for you"
                    action="Explore practice"
                    to="/practice"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    {recommendations.map((item) => (
                      <button
                        key={item.type}
                        onClick={() =>
                          setActivity(`${item.tab} activities are being prepared for a later step.`)
                        }
                        className={`clay-card flex items-start gap-3 bg-${item.color}-soft p-4 text-left md:p-5`}
                      >
                        <IconBubble icon={item.icon} color={item.color} />
                        <div>
                          <p className="text-[11px] font-black uppercase text-ink-soft">
                            {item.type}
                          </p>
                          <h3 className="mt-1 font-display text-base font-black leading-snug">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-xs text-ink-soft">{item.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="space-y-6">
                <HomeGamification student={student} />
                <div className="hidden">
                  <section className="clay-card bg-card p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="font-display text-xl font-black">Study progress</h2>
                      <IconBubble icon={Target} color="pink" />
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="relative flex size-[112px] shrink-0 items-center justify-center rounded-full progress-gradient p-[10px]">
                        <div className="flex size-full flex-col items-center justify-center rounded-full bg-card">
                          <span className="font-display text-2xl font-black">
                            0<span className="text-sm">/{minutes}</span>
                          </span>
                          <span className="text-[11px] font-bold text-muted-foreground">
                            min today
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold">Your daily goal</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Small steps add up. You've got this!
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-5 text-center">
                      <div>
                        <p className="font-display text-xl font-black">{student?.xp ?? 0}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black">{student?.level ?? 1}</p>
                        <p className="text-xs text-muted-foreground">Level</p>
                      </div>
                      <div>
                        <p className="flex items-center justify-center gap-1 font-display text-xl font-black">
                          <Flame size={17} className="text-pink" />
                          {student?.streak_days ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Streak</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex justify-between text-xs font-extrabold">
                        <span>Weekly goal</span>
                        <span>0 / {Math.round((minutes * 7) / 60)} hrs</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted soft-inset">
                        <div className="h-full w-0 rounded-full progress-gradient" />
                      </div>
                    </div>
                  </section>
                  <section className="clay-card bg-yellow-soft p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-ink-soft">Quick review</p>
                        <h2 className="mt-1 font-display text-xl font-black">Flashcards due</h2>
                      </div>
                      <IconBubble icon={Layers3} color="yellow" />
                    </div>
                    <div className="my-5 flex items-end gap-2">
                      <span className="font-display text-5xl font-black">18</span>
                      <span className="pb-1 text-sm font-bold text-ink-soft">
                        cards · about 8 min
                      </span>
                    </div>
                    <Button
                      variant="yellow"
                      className="w-full"
                      onClick={() => setActivity("Flashcard reviews are coming in a later step.")}
                    >
                      Review now <ArrowRight size={17} />
                    </Button>
                  </section>
                  <section className="clay-card bg-mint-soft p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-black">USMLE Prep</h2>
                      <IconBubble icon={GraduationCap} color="mint" />
                    </div>
                    <div className="mt-5 space-y-4">
                      <div className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-sm">
                          👋
                        </span>
                        <div>
                          <p className="text-sm font-bold">Find a USMLE coach</p>
                          <p className="text-xs text-ink-soft">Structured Step 1 & 2 classes</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-sm">
                          ✨
                        </span>
                        <div>
                          <p className="text-sm font-bold">Enroll in a class</p>
                          <p className="text-xs text-ink-soft">Learn from experienced coaches</p>
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/usmle"
                      className="mt-5 inline-flex items-center gap-1 text-sm font-extrabold"
                    >
                      Browse coaches <ArrowRight size={16} />
                    </Link>
                  </section>
                  <section className="clay-card bg-pink-soft p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-black">Achievements</h2>
                      <IconBubble icon={Trophy} color="pink" />
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <span className="flex size-14 items-center justify-center rounded-2xl bg-yellow text-2xl shadow-sm">
                        🏅
                      </span>
                      <div>
                        <p className="font-display font-black">Getting into the rhythm</p>
                        <p className="text-sm text-ink-soft">
                          {student?.streak_days ?? 0}-day study streak
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
        {view === "cases" && (
          <StudentContext.Provider value={student}>{children}</StudentContext.Provider>
        )}
        {view === "practice" && children && (
          <StudentContext.Provider value={student}>{children}</StudentContext.Provider>
        )}
        {view === "practice" && !children && (
          <div>
            <PageIntro
              eyebrow="YOUR PRACTICE SPACE"
              title="Practice your way"
              description="Short, focused sessions for every part of your learning."
              icon={Stethoscope}
              color="pink"
            />
            <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
              {(["OSCE", "Quizzes", "Flashcards"] as PracticeTab[]).map((tab) => (
                <Button
                  key={tab}
                  variant={
                    practiceTab === tab
                      ? tab === "OSCE"
                        ? "pink"
                        : tab === "Quizzes"
                          ? "blue"
                          : "yellow"
                      : "secondary"
                  }
                  onClick={() => setPracticeTab(tab)}
                  className="shrink-0"
                >
                  {tab === "OSCE" ? <Stethoscope /> : tab === "Quizzes" ? <Brain /> : <Layers3 />}
                  {tab}
                </Button>
              ))}
            </div>
            <section
              className={`clay-card mt-5 bg-${practiceTab === "OSCE" ? "pink" : practiceTab === "Quizzes" ? "blue" : "yellow"}-soft p-6 md:p-9`}
            >
              <div className="flex items-start gap-4">
                <IconBubble
                  icon={
                    practiceTab === "OSCE"
                      ? Stethoscope
                      : practiceTab === "Quizzes"
                        ? Brain
                        : Layers3
                  }
                  color={
                    practiceTab === "OSCE" ? "pink" : practiceTab === "Quizzes" ? "blue" : "yellow"
                  }
                />
                <div>
                  <h2 className="font-display text-2xl font-black">
                    {practiceTab === "OSCE"
                      ? "OSCE stations"
                      : practiceTab === "Quizzes"
                        ? "Quick quizzes"
                        : "Flashcard decks"}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                    {practiceTab === "OSCE" ? (
                      <>
                        Conduct the available history station, with more station types coming soon.{" "}
                        <Link to="/osce" className="font-extrabold text-pink underline">
                          Open the station bank →
                        </Link>
                      </>
                    ) : practiceTab === "Quizzes" ? (
                      <>
                        Test your understanding with bite-sized questions.{" "}
                        <Link to="/quiz" className="font-extrabold text-blue underline">
                          Open quizzes →
                        </Link>
                      </>
                    ) : (
                      <>
                        Keep the important details fresh with quick review sessions.{" "}
                        <Link to="/flashcards" className="font-extrabold underline">
                          Open decks →
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl bg-card/70 p-5">
                <p className="text-sm font-bold">
                  {practiceTab === "OSCE"
                    ? "Focused history taking"
                    : practiceTab === "Quizzes"
                      ? `${weakAreas[0]} essentials`
                      : `${personalizedSubjects[0]} quick recall`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {practiceTab === "OSCE"
                    ? "History taking · 8 min"
                    : practiceTab === "Quizzes"
                      ? "10 questions · 8 min"
                      : "18 cards · 8 min"}
                </p>
                <Button
                  variant={
                    practiceTab === "OSCE" ? "pink" : practiceTab === "Quizzes" ? "blue" : "yellow"
                  }
                  className="mt-5"
                  onClick={() => {
                    window.location.href =
                      practiceTab === "OSCE"
                        ? "/osce"
                        : practiceTab === "Quizzes"
                          ? "/quiz"
                          : "/flashcards";
                  }}
                >
                  Start practice <ArrowRight />
                </Button>
              </div>
            </section>
          </div>
        )}
        {view === "usmle" && (
          <StudentContext.Provider value={student}>{children}</StudentContext.Provider>
        )}
        {view === "leaderboards" && (
          <StudentContext.Provider value={student}>{children}</StudentContext.Provider>
        )}
        {view === "profile" && isCoach && (
          <div>
            <PageIntro
              eyebrow="YOUR COACHING PROFILE"
              title="Coach profile"
              description="This is how students see you across USMLE Prep."
              icon={GraduationCap}
              color="mint"
            />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="clay-card bg-card p-6">
                <div className="flex items-center gap-4">
                  <span className="flex size-16 items-center justify-center rounded-3xl bg-mint font-display text-xl font-black">
                    {coach ? initials(coach.name) : "?"}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-black">{coach?.name ?? "Coach"}</h2>
                    <p className="truncate text-sm text-muted-foreground">{coach?.email}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4 text-sm">
                  <InfoRow label="Headline" value={coach?.headline || "Not set"} />
                  <InfoRow label="Availability" value={coach?.availability || "Not set"} />
                </div>
              </div>
              <div className="clay-card bg-mint-soft p-6">
                <h2 className="font-display text-xl font-black">Areas of expertise</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {coach?.expertise?.length ? (
                    coach.expertise.map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-card px-3 py-1.5 text-xs font-bold"
                      >
                        {area}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm">Not set</span>
                  )}
                </div>
                {coach?.bio && <p className="mt-5 text-sm leading-relaxed">{coach.bio}</p>}
                <Link
                  to="/usmle"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-extrabold"
                >
                  Edit on your dashboard <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        )}
        {view === "profile" && !isCoach && (
          <div>
            <PageIntro
              eyebrow="YOUR STUDY JOURNEY"
              title="Student profile"
              description="A snapshot of where you are and where you want to go."
              icon={Activity}
              color="blue"
            />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="clay-card bg-card p-6">
                <div className="flex items-center gap-4">
                  <span className="flex size-16 items-center justify-center rounded-3xl bg-mint font-display text-xl font-black">
                    {student ? initials(student.name) : "?"}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-black">
                      {student?.name ?? "Loading student"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Year {student?.year_of_study} · {student?.medical_program}
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-4 text-sm">
                  <InfoRow label="University" value={student?.university ?? "—"} />
                  <InfoRow label="Country" value={student?.country ?? "—"} />
                  <InfoRow
                    label="Current rotation"
                    value={student?.current_rotation ?? "Not set"}
                  />
                  <InfoRow label="Study goal" value={student?.study_goal ?? "Not set"} />
                  <InfoRow label="Daily target" value={`${minutes} minutes`} />
                </div>
              </div>
              <div className="clay-card bg-lavender-soft p-6">
                <h2 className="font-display text-xl font-black">Learning focus</h2>
                <p className="mt-5 text-xs font-extrabold uppercase text-ink-soft">Studying now</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {personalizedSubjects.map((subject) => (
                    <span
                      key={subject}
                      className="rounded-full bg-card px-3 py-1.5 text-xs font-bold"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-xs font-extrabold uppercase text-ink-soft">Interested in</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {student?.specialty_interests.length ? (
                    student.specialty_interests.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-card px-3 py-1.5 text-xs font-bold"
                      >
                        {subject}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm">Not set</span>
                  )}
                </div>
                <p className="mt-6 text-xs font-extrabold uppercase text-ink-soft">
                  Needs more practice
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weakAreas.map((subject) => (
                    <span
                      key={subject}
                      className="rounded-full bg-card px-3 py-1.5 text-xs font-bold"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
              <div className="clay-card progress-gradient p-6 md:col-span-2">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="font-display text-3xl font-black">{student?.xp ?? 0}</p>
                    <p className="text-xs font-bold">Total XP</p>
                  </div>
                  <div>
                    <p className="font-display text-3xl font-black">{student?.level ?? 1}</p>
                    <p className="text-xs font-bold">Level</p>
                  </div>
                  <div>
                    <p className="font-display text-3xl font-black">{student?.streak_days ?? 0}</p>
                    <p className="text-xs font-bold">Day streak</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {view === "profile" && !isCoach && (
          <div>
            <ProgressDashboard student={student} />
          </div>
        )}
      </main>
      <nav
        aria-label="Main navigation"
        className="app-main-nav app-tabbar fixed bottom-0 left-0 right-0 z-20 rounded-t-[24px] border-t border-border/70 bg-card/90 px-2 pt-1.5 shadow-[0_-8px_30px_-14px_var(--border)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <Link
                key={item.label}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`app-tabitem flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-extrabold transition-colors active:scale-95 ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-lavender-soft" : "bg-transparent"}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {activity && (
        <div
          className="sheet-scrim fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center sm:p-5"
          onClick={() => setActivity(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Coming soon"
            className="clay-card mobile-sheet w-full rounded-t-[28px] bg-card p-6 text-center sm:max-w-sm sm:rounded-[24px] sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lavender-soft">
              <Sparkles />
            </span>
            <h2 className="mt-4 font-display text-xl font-black">Coming soon</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activity}</p>
            <Button onClick={() => setActivity(null)} className="mt-6 w-full">
              Got it
            </Button>
          </div>
        </div>
      )}
      <CelebrationLayer student={student} />
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  icon: Icon,
  color,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Home;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-black uppercase text-ink-soft">
        <Icon size={17} className={`text-${color}`} />
        {eyebrow}
      </div>
      <h1 className="mt-3 font-display text-3xl font-black md:text-5xl">{title}</h1>
      <p className="mt-3 text-base text-muted-foreground md:text-lg">{description}</p>
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-3 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-bold">{value}</span>
    </div>
  );
}
