import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  CheckCircle2,
  Flame,
  GraduationCap,
  HeartPulse,
  Layers3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURED_CASE } from "@/features/case-challenge/featured-case";

/**
 * Public landing page — the front door shown to signed-out visitors at `/`.
 * Signed-in students/coaches get the study shell instead (see routes/index.tsx).
 * Everything here reuses the app's claymorphic language: Nunito display type,
 * soft pastel surfaces, `clay-card` / `clay-button` depth, and pill chips.
 */

const SUBJECTS = [
  "Anatomy",
  "Physiology",
  "Pharmacology",
  "Pathology",
  "Internal Medicine",
  "Surgery",
  "Paediatrics",
  "Obstetrics & Gynaecology",
  "Microbiology",
  "Biochemistry",
  "Clinical Skills",
  "Public Health",
];

type FeatureColor = "lavender" | "pink" | "blue" | "mint" | "yellow";

const FEATURES: {
  icon: typeof HeartPulse;
  color: FeatureColor;
  tag: string;
  title: string;
  body: string;
}[] = [
  {
    icon: HeartPulse,
    color: "lavender",
    tag: "Clinical cases",
    title: "Reason through real patients",
    body: "Branching cases take you from presentation to diagnosis. Gather evidence, watch the patient change, commit to a plan, then review exactly what your decisions did.",
  },
  {
    icon: Stethoscope,
    color: "pink",
    tag: "OSCE stations",
    title: "Rehearse the exam room",
    body: "A timed door note, a simulated consultation, examiner questions and a scored debrief — practised solo in Learn, Practice or Exam mode.",
  },
  {
    icon: BookOpenText,
    color: "blue",
    tag: "Study with Annie",
    title: "Read your notes, actively",
    body: "Upload your own PDFs and read them with Annie — she explains any passage you select and quietly checks whether you can recall it in your own words.",
  },
  {
    icon: Brain,
    color: "mint",
    tag: "Quizzes",
    title: "Questions that teach back",
    body: "Quick, topic, timed and adaptive modes across the core sciences, with a clear explanation behind every answer option — not just the right one.",
  },
  {
    icon: Layers3,
    color: "yellow",
    tag: "Flashcards",
    title: "Remember it for the exam",
    body: "Spaced-repetition decks resurface high-yield cards at the moment you're about to forget them, so review time lands where it counts.",
  },
  {
    icon: GraduationCap,
    color: "lavender",
    tag: "USMLE Prep",
    title: "Learn alongside a coach",
    body: "Find experienced coaches for structured Step 1 & 2 classes, enroll in a cohort, read reviews and message your coach directly.",
  },
];

const LOOP: { icon: typeof HeartPulse; color: FeatureColor; step: string; label: string }[] = [
  { icon: BookOpenText, color: "blue", step: "Learn", label: "Read a concept actively with Annie" },
  { icon: Brain, color: "mint", step: "Recall", label: "Lock it in with quizzes & cards" },
  { icon: HeartPulse, color: "lavender", step: "Apply", label: "Use it on a patient case or OSCE" },
  { icon: Target, color: "pink", step: "Reflect", label: "See weak spots, come back stronger" },
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center gap-2.5 font-display text-[26px] font-black text-foreground ${className}`}
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-pink text-foreground shadow-sm">
        <HeartPulse size={23} strokeWidth={2.5} />
      </span>
      medley<span className="text-pink">.</span>
    </span>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="app-container flex items-center justify-between gap-3 py-3.5 md:py-4">
        <Link to="/" aria-label="Medley home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
          {[
            { href: "#features", label: "Features" },
            { href: "#how", label: "How it works" },
            { href: "#cases", label: "Case simulator" },
            { href: "#usmle", label: "USMLE Prep" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" className="bg-card shadow-sm hover:bg-card">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="lavender">
            <Link to="/register">
              Get started <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft pastel glow behind the hero for depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(42rem 28rem at 18% -8%, var(--lavender-soft), transparent 70%), radial-gradient(38rem 26rem at 98% 2%, var(--pink-soft), transparent 68%), radial-gradient(34rem 24rem at 60% 108%, var(--blue-soft), transparent 72%)",
        }}
      />
      <div className="app-container grid items-center gap-12 pb-10 pt-12 md:pb-16 md:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-ink-soft shadow-sm">
            <Sparkles size={15} className="text-pink" /> One study space for medicine
          </span>
          <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Study medicine the way you'll{" "}
            <span className="relative whitespace-nowrap text-primary">
              practise it
              <svg
                aria-hidden
                viewBox="0 0 220 12"
                className="absolute -bottom-1.5 left-0 h-2.5 w-full text-lavender"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8c40-6 110-6 216-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Cases, OSCEs, quizzes, flashcards, your own notes and USMLE coaching — brought into one
            joyful place that moves you from reading a fact to using it on a patient.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="lavender" size="lg" className="text-base">
              <Link to="/register">
                Create your free account <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="bg-card text-base hover:bg-card"
            >
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShieldCheck size={16} className="text-mint" />A learning aid — never a substitute for
            clinical supervision.
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A tasteful mock of the signed-in experience, built from the same clay pieces. */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mr-0">
      {/* Weekly case card — mirrors the real home screen's featured case. */}
      <div className="clay-card bg-lavender-soft p-5 md:p-6">
        <span className="inline-flex rounded-full bg-card/75 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
          ✦ Weekly case
        </span>
        <div className="mt-4 flex items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-lavender shadow-[inset_0_2px_1px_var(--card)]">
            <HeartPulse size={24} strokeWidth={2.3} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-xl font-black leading-tight">{FEATURED_CASE.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink-soft">
              <span className="rounded-full bg-card/70 px-2.5 py-1">
                Level {FEATURED_CASE.difficulty}
              </span>
              {FEATURED_CASE.specialty.slice(0, 2).map((s) => (
                <span key={s} className="rounded-full bg-card/70 px-2.5 py-1">
                  {s}
                </span>
              ))}
            </div>
            <span className="clay-button mt-4 inline-flex items-center gap-1.5 rounded-full bg-lavender px-4 py-2 text-sm font-black text-foreground">
              Start case <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </div>

      {/* Supporting row: a mini progress ring + a quiz result tile. */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="clay-card flex items-center gap-3 bg-card p-4">
          <div className="relative grid size-14 shrink-0 place-items-center rounded-full progress-gradient p-[6px]">
            <div className="grid size-full place-items-center rounded-full bg-card">
              <span className="font-display text-sm font-black">72%</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase text-muted-foreground">Today</p>
            <p className="truncate font-display text-sm font-black">Daily goal</p>
          </div>
        </div>
        <div className="clay-card bg-mint-soft p-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-card text-mint">
            <CheckCircle2 size={19} strokeWidth={2.4} />
          </span>
          <p className="mt-2.5 font-display text-sm font-black leading-tight">Correct!</p>
          <p className="text-[11px] font-bold text-ink-soft">+20 XP · Pharmacology</p>
        </div>
      </div>

      {/* Floating streak chip, offset for a layered, product-y feel. */}
      <div className="clay-card absolute -right-3 -top-4 flex items-center gap-2 rounded-full bg-yellow-soft px-3.5 py-2 text-sm font-black md:-right-5">
        <Flame size={17} className="text-pink" /> 12 day streak
      </div>
    </div>
  );
}

function StatStrip() {
  const stats = [
    { value: "6", label: "study tools, one space" },
    { value: "12", label: "core subjects covered" },
    { value: "3", label: "OSCE modes: Learn · Practice · Exam" },
    { value: "∞", label: "attempts — practise until it sticks" },
  ];
  return (
    <section className="app-container">
      <div className="clay-card grid grid-cols-2 gap-6 bg-card p-6 md:grid-cols-4 md:p-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <p className="font-display text-3xl font-black text-primary md:text-4xl">{s.value}</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-black uppercase tracking-wider text-pink">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-black md:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-base leading-relaxed text-ink-soft md:text-lg">{body}</p>}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="app-container scroll-mt-24">
      <SectionHead
        eyebrow="Everything in one place"
        title="Six ways to practise, no tab-juggling"
        body="Each tool does one thing well — and they share your progress, so moving between them feels like one continuous study session."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.tag} className={`clay-card bg-${f.color}-soft p-6`}>
            <span
              className={`flex size-12 items-center justify-center rounded-2xl bg-card text-${f.color} shadow-[inset_0_2px_1px_var(--card)]`}
            >
              <f.icon size={23} strokeWidth={2.3} />
            </span>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-ink-soft">
              {f.tag}
            </p>
            <h3 className="mt-1 font-display text-xl font-black leading-snug">{f.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningLoop() {
  return (
    <section id="how" className="app-container scroll-mt-24">
      <SectionHead
        eyebrow="How Medley works"
        title="A loop that turns notes into know-how"
        body="Studying sticks when you learn, recall, apply and reflect — then go again. Medley keeps that whole cycle under one roof."
      />
      <div className="relative mt-12 grid gap-4 md:grid-cols-4">
        {/* Connecting rail on desktop. */}
        <div
          aria-hidden
          className="absolute left-[12%] right-[12%] top-7 hidden h-0.5 md:block"
          style={{
            background:
              "linear-gradient(90deg, var(--blue), var(--mint), var(--lavender), var(--pink))",
            opacity: 0.4,
          }}
        />
        {LOOP.map((item, i) => (
          <div key={item.step} className="relative flex flex-col items-center text-center">
            <span
              className={`relative z-10 flex size-14 items-center justify-center rounded-full bg-${item.color}-soft text-${item.color} ring-4 ring-background`}
            >
              <item.icon size={24} strokeWidth={2.3} />
            </span>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Step {i + 1}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-black">{item.step}</h3>
            <p className="mt-1.5 max-w-[14rem] text-sm leading-relaxed text-ink-soft">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaseSpotlight() {
  const points = [
    "Order histories, exams, labs and imaging — then defend your reasoning",
    "Vitals drift and the patient deteriorates if you stall",
    "Commit to a diagnosis and management plan under real clinical time",
    "A scored debrief shows missed evidence and the teaching points",
  ];
  return (
    <section id="cases" className="app-container scroll-mt-24">
      <div className="clay-card overflow-hidden bg-lavender-soft p-7 md:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-ink-soft">
              <Sparkles size={14} className="text-lavender" /> Flagship simulator
            </span>
            <h2 className="mt-5 font-display text-3xl font-black leading-tight md:text-4xl">
              The clinical case simulator
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft md:text-lg">
              Knowing a fact and knowing when it matters are different skills. Branching cases put
              you in the room so you can build the second one safely.
            </p>
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-mint">
                    <CheckCircle2 size={16} strokeWidth={2.6} />
                  </span>
                  <span className="text-sm font-semibold leading-relaxed text-foreground md:text-base">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="lavender" className="mt-8">
              <Link to="/register">
                Try a case <ArrowRight size={16} />
              </Link>
            </Button>
          </div>

          {/* Vitals / status mock to evoke the real cockpit. */}
          <div className="clay-card bg-card p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-lavender-soft text-lavender">
                  <HeartPulse size={20} strokeWidth={2.4} />
                </span>
                <div>
                  <p className="font-display text-sm font-black">Patient monitor</p>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    Live during the case
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-pink-soft px-2.5 py-1 text-[11px] font-black text-pink">
                ● stable
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { k: "HR", v: "98", u: "bpm", c: "pink" },
                { k: "BP", v: "138/86", u: "mmHg", c: "lavender" },
                { k: "SpO₂", v: "96", u: "%", c: "blue" },
              ].map((vital) => (
                <div
                  key={vital.k}
                  className="rounded-2xl border border-border bg-background p-3 text-center"
                >
                  <p className="text-[11px] font-black uppercase text-muted-foreground">
                    {vital.k}
                  </p>
                  <p className={`mt-1 font-display text-xl font-black text-${vital.c}`}>
                    {vital.v}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground">{vital.u}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted p-4 soft-inset">
              <p className="text-[11px] font-black uppercase text-muted-foreground">
                Your next move
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {["Take history", "Examine", "Order labs", "Treat"].map((a, i) => (
                  <span
                    key={a}
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      i === 0 ? "bg-lavender text-foreground" : "bg-card text-ink-soft"
                    }`}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UsmleCallout() {
  return (
    <section id="usmle" className="app-container scroll-mt-24">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="clay-card bg-mint-soft p-7 md:p-9">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-mint">
            <GraduationCap size={24} strokeWidth={2.3} />
          </span>
          <h3 className="mt-5 font-display text-2xl font-black">USMLE Prep with real coaches</h3>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Browse experienced coaches, enroll in structured Step 1 & 2 classes, read reviews from
            other students and message your coach directly — all inside Medley.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Structured classes", "Direct messaging", "Student reviews", "Announcements"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-card px-3 py-1.5 text-xs font-extrabold text-ink-soft"
                >
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="clay-card bg-blue-soft p-7 md:p-9">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-blue">
            <MessageCircle size={24} strokeWidth={2.3} />
          </span>
          <h3 className="mt-5 font-display text-2xl font-black">Coaching made for you</h3>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Teaching Step prep? Create your coaching profile, open classes, enroll students and keep
            your cohort in the loop — Medley handles enrollment, reviews and messaging.
          </p>
          <Button asChild variant="blue" className="mt-6">
            <Link to="/register">
              Join as a coach <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SubjectMarquee() {
  return (
    <section className="app-container">
      <p className="text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
        Built around the subjects you actually sit
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {SUBJECTS.map((s) => (
          <span
            key={s}
            className="clay-card rounded-full bg-card px-4 py-2 text-sm font-extrabold text-ink-soft"
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="app-container">
      <div className="clay-card relative overflow-hidden progress-gradient p-9 text-center md:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(20rem 14rem at 15% 10%, #fff, transparent 60%), radial-gradient(22rem 16rem at 90% 90%, #fff, transparent 60%)",
          }}
        />
        <div className="relative">
          <span className="flex mx-auto size-14 items-center justify-center rounded-2xl bg-card text-pink shadow-sm">
            <Trophy size={27} strokeWidth={2.3} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-black text-foreground md:text-5xl">
            Ready to study smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-relaxed text-foreground/80 md:text-lg">
            Create your free account and start with this week's case. Your progress, streaks and
            weak spots are waiting.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-card text-base text-foreground hover:bg-card">
              <Link to="/register">
                Get started free <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-foreground/10 text-base text-foreground hover:bg-foreground/15"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="app-container">
      <div className="flex flex-col items-center justify-between gap-6 border-t border-border/70 py-10 md:flex-row">
        <Wordmark className="text-[22px]" />
        <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground md:text-right">
          Medley is a learning aid for medical and health-science students. It is not a source of
          clinical advice and does not replace institutional teaching or supervision.
        </p>
      </div>
      <p className="pb-10 text-center text-xs font-semibold text-muted-foreground md:text-right">
        © {new Date().getFullYear()} Medley
      </p>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="app-shell bg-background">
      <LandingNav />
      <main className="space-y-20 pb-8 md:space-y-28">
        <Hero />
        <StatStrip />
        <Features />
        <LearningLoop />
        <CaseSpotlight />
        <UsmleCallout />
        <SubjectMarquee />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
