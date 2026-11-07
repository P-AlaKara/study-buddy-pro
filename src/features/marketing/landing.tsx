import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Brain,
  CheckCircle2,
  ChevronDown,
  Flame,
  Flower2,
  GraduationCap,
  HeartPulse,
  Layers3,
  Lightbulb,
  Menu,
  Sprout,
  Stethoscope,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public landing page — the front door shown to signed-out visitors at `/`.
 * Signed-in students/coaches get the study shell instead (see routes/index.tsx).
 *
 * Redesigned after the "Medley" marketing prototype: a playful claymorphic
 * story that walks from "study it" to "use it". It reuses the app's own design
 * language — Nunito display type, pastel `-soft` surfaces, `clay-card` depth,
 * pill chips and the shared `Button` — so the front door matches the product
 * behind it, and stays responsive from small phones up to wide desktops.
 */

type SoftColor = "lavender" | "pink" | "blue" | "mint" | "yellow";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#exams", label: "Exam Generator" },
  { href: "#progress", label: "Your progress" },
];

const PILLARS: { icon: typeof Brain; color: SoftColor; label: string }[] = [
  { icon: Brain, color: "lavender", label: "Remember what matters" },
  { icon: Stethoscope, color: "pink", label: "Practise real reasoning" },
  { icon: Sprout, color: "mint", label: "Grow with feedback" },
];

const FEATURES: {
  icon: typeof HeartPulse;
  color: SoftColor;
  title: string;
  body: string;
  href: string;
}[] = [
  {
    icon: HeartPulse,
    color: "lavender",
    title: "Clinical cases",
    body: "Follow the clues, make decisions, and learn from how your choices play out on a real patient.",
    href: "#how",
  },
  {
    icon: Stethoscope,
    color: "pink",
    title: "OSCE practice",
    body: "Walk into a simulated station, practise your approach, and get a meaningful, scored debrief.",
    href: "#how",
  },
  {
    icon: BookOpenText,
    color: "blue",
    title: "Exam Generator",
    body: "Turn your PDFs and slides into a comprehensive, source-grounded exam — and save tricky questions to flashcards.",
    href: "#exams",
  },
  {
    icon: Lightbulb,
    color: "mint",
    title: "Quizzes",
    body: "Test what you know, understand every answer option, and retry the questions you missed.",
    href: "#progress",
  },
  {
    icon: Layers3,
    color: "yellow",
    title: "Flashcards",
    body: "Make knowledge stick with personal decks and spaced-repetition reviews that land on time.",
    href: "#progress",
  },
  {
    icon: GraduationCap,
    color: "lavender",
    title: "USMLE Prep",
    body: "Find coaches, join structured Step 1 & 2 classes, read reviews and message your coach directly.",
    href: "/register",
  },
];

const LOOP: { color: SoftColor; step: string; label: string }[] = [
  {
    color: "lavender",
    step: "Learn",
    label: "Turn your notes into a comprehensive exam with the Exam Generator.",
  },
  {
    color: "yellow",
    step: "Remember",
    label: "Recall the essentials with quizzes and flashcards.",
  },
  { color: "blue", step: "Apply", label: "Work through a clinical case or OSCE station." },
  { color: "mint", step: "Improve", label: "Use your feedback to choose what comes next." },
];

const EXAM_BENEFITS = [
  "Comprehensive coverage of every topic in your notes",
  "MCQs, short and long answers — each grounded in your material",
  "Save any question to flashcards in a couple of clicks",
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center gap-2.5 font-display text-[26px] font-black leading-none text-foreground ${className}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-pink text-foreground shadow-sm">
        <HeartPulse size={22} strokeWidth={2.5} />
      </span>
      medley<span className="text-pink">.</span>
    </span>
  );
}

function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="app-container flex items-center justify-between gap-3 py-3.5 md:py-4">
        <Link to="/" aria-label="Medley home" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
          {NAV_LINKS.map((item) => (
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
          <Button
            asChild
            variant="secondary"
            className="hidden bg-card shadow-sm hover:bg-card sm:inline-flex"
          >
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="lavender">
            <Link to="/register">
              Get started <ArrowRight size={16} />
            </Link>
          </Button>
          <button
            type="button"
            className="clay-button flex size-11 items-center justify-center bg-card text-foreground lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="app-container flex flex-col gap-1 pb-4 lg:hidden"
          aria-label="Sections (mobile)"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="rounded-2xl px-4 py-3 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}

const CASE_CHOICES = [
  "Ask a focused follow-up question",
  "Review the patient's vital signs",
  "Form a working differential",
];

/** Interactive mock of the clinical-case cockpit — cycles a "next step" choice. */
function CaseWindow() {
  const [active, setActive] = useState(1);
  const stepLabel = `Step ${active + 3} of 5`;
  const progress = 55 + active * 15;

  return (
    <div className="clay-card w-full bg-card p-4 md:p-5">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        <span>✳ medley / clinical cases</span>
        <span className="flex gap-1" aria-hidden>
          <i className="size-2 rounded-full bg-pink" />
          <i className="size-2 rounded-full bg-yellow" />
          <i className="size-2 rounded-full bg-mint" />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-lavender-soft p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-lavender shadow-[inset_0_2px_1px_var(--card)]">
          <HeartPulse size={24} strokeWidth={2.3} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">
            Case challenge 01
          </p>
          <p className="font-display text-base font-black leading-tight">Think like a clinician</p>
          <p className="text-[11px] font-bold text-ink-soft">Gather clues · Make a decision</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
          <span>Case progress</span>
          <span>{stepLabel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-lavender transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-4 font-display text-sm font-black">What would you do next?</p>
      <div className="mt-2 space-y-2">
        {CASE_CHOICES.map((choice, i) => {
          const selected = i === active;
          return (
            <div
              key={choice}
              className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-[11px] font-bold transition-colors ${
                selected
                  ? "border-mint/60 bg-mint-soft text-foreground"
                  : "border-border bg-background text-ink-soft"
              }`}
            >
              <span
                className={`grid size-3.5 shrink-0 place-items-center rounded-full border ${
                  selected ? "border-mint bg-mint" : "border-border"
                }`}
              >
                {selected && <CheckCircle2 size={10} className="text-foreground" strokeWidth={3} />}
              </span>
              {choice}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground">✧ Learn by doing</span>
        <button
          type="button"
          onClick={() => setActive((v) => (v + 1) % CASE_CHOICES.length)}
          className="clay-button inline-flex items-center gap-1 rounded-full bg-lavender px-3.5 py-2 text-[11px] font-black text-foreground"
        >
          Next step <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

function FloatingChip({
  icon: Icon,
  color,
  title,
  sub,
  className = "",
}: {
  icon: typeof Flame;
  color: SoftColor;
  title: string;
  sub: string;
  className?: string;
}) {
  return (
    <div
      className={`clay-card absolute hidden items-center gap-2.5 bg-card p-3 md:flex ${className}`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl bg-${color}-soft text-${color}`}
      >
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <div className="leading-tight">
        <p className="font-display text-xs font-black">{title}</p>
        <p className="text-[10px] font-bold text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(42rem 28rem at 16% -8%, var(--lavender-soft), transparent 70%), radial-gradient(38rem 26rem at 98% 4%, var(--pink-soft), transparent 68%), radial-gradient(34rem 24rem at 62% 112%, var(--blue-soft), transparent 72%)",
        }}
      />
      <div className="app-container grid items-center gap-10 pb-10 pt-10 md:pb-16 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-4 lg:pt-20 xl:gap-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-ink-soft shadow-sm">
            <span className="size-2 rounded-full bg-pink" /> Learning, but make it active
          </span>
          <h1 className="mt-5 font-display text-5xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Study it.
            <br />
            Recall it.
            <br />
            <span className="relative isolate whitespace-nowrap text-primary">
              Use it.
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-yellow"
                style={{ transform: "rotate(-2deg)" }}
              />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Meet your new favourite study space. Clinical cases, OSCEs, quizzes, flashcards and your
            own notes — finally working together for the way future healthcare pros learn.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="lavender" size="lg" className="text-base">
              <Link to="/register">
                Start learning <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="bg-card text-base hover:bg-card"
            >
              <a href="#how">
                See how it works <ChevronDown size={18} />
              </a>
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="flex -space-x-1.5" aria-hidden>
              <span className="grid size-7 place-items-center rounded-lg border-2 border-background bg-lavender-soft text-xs">
                ♡
              </span>
              <span className="grid size-7 place-items-center rounded-lg border-2 border-background bg-mint-soft text-xs">
                ✚
              </span>
              <span className="grid size-7 place-items-center rounded-lg border-2 border-background bg-yellow-soft text-xs">
                ✦
              </span>
            </span>
            Made for medical &amp; health-science students
          </p>
        </div>

        {/* Case window + layered floating chips. The tight relative box anchors
            the chips to the window edges; it tilts slightly on desktop and hugs
            the left of its column so it sits close to the hero copy. Chips hide
            below md to avoid overflow; the window carries the story on phones. */}
        <div className="relative mx-auto w-full max-w-md pt-4 md:max-w-lg md:pt-0 lg:mx-0 lg:rotate-[3deg] xl:max-w-xl">
          <CaseWindow />
          <FloatingChip
            icon={Flower2}
            color="pink"
            title="Your exam is ready!"
            sub="Built from your own notes"
            className="-left-4 top-[14%] lg:-left-5"
          />
          <FloatingChip
            icon={Flame}
            color="yellow"
            title="Keep your momentum"
            sub="One session at a time"
            className="-right-4 bottom-[18%] lg:-right-8"
          />
          <FloatingChip
            icon={Stethoscope}
            color="blue"
            title="OSCE practice"
            sub="Confidence, step by step"
            className="-bottom-5 left-2"
          />
        </div>
      </div>
    </section>
  );
}

function PillarStrip() {
  return (
    <section className="app-container" aria-label="How Medley studies">
      <div className="clay-card grid gap-5 bg-card p-6 sm:grid-cols-3 md:p-7">
        {PILLARS.map((p) => (
          <div key={p.label} className="flex items-center justify-center gap-3 sm:justify-start">
            <span
              className={`flex size-10 items-center justify-center rounded-xl bg-${p.color}-soft text-${p.color}`}
            >
              <p.icon size={20} strokeWidth={2.4} />
            </span>
            <span className="font-display text-base font-black">{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-black uppercase tracking-wider text-pink">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-black leading-tight md:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-base leading-relaxed text-ink-soft md:text-lg">{body}</p>}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="app-container scroll-mt-24">
      <SectionHead
        eyebrow="Your all-in-one study space"
        title={
          <>
            Everything clicks <span className="text-lavender">together.</span>
          </>
        }
        body="From the first time you meet a topic to the moment you're ready to apply it, there's a Medley mode for that."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`flex size-14 items-center justify-center rounded-2xl bg-card text-${f.color} shadow-[inset_0_2px_1px_var(--card)]`}
                >
                  <f.icon size={26} strokeWidth={2.3} />
                </span>
                <span className="grid size-8 place-items-center rounded-full bg-card/70 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-black leading-snug">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </>
          );
          const cls = `clay-card group block bg-${f.color}-soft p-6`;
          return f.href.startsWith("#") ? (
            <a key={f.title} href={f.href} className={cls}>
              {inner}
            </a>
          ) : (
            <Link key={f.title} to={f.href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LearningLoop() {
  return (
    <section id="how" className="scroll-mt-24 rounded-[2.5rem] bg-pink-soft/60 py-16 md:py-20">
      <div className="app-container">
        <SectionHead
          eyebrow="The Medley method"
          title={
            <>
              One little loop.
              <br />
              <span className="text-pink">A lot of learning.</span>
            </>
          }
          body="No more switching between disconnected study tools. Move naturally from understanding a concept to using it."
        />
        <div className="relative mt-12 grid gap-y-10 gap-x-4 sm:grid-cols-2 md:grid-cols-4">
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-10 hidden border-t-2 border-dashed border-pink/35 md:block"
          />
          {LOOP.map((item, i) => (
            <div key={item.step} className="relative flex flex-col items-center text-center">
              <span
                className={`relative z-10 flex size-20 items-center justify-center rounded-3xl bg-${item.color}-soft font-display text-3xl font-black text-foreground ring-4 ring-background`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-xl font-black">{item.step}</h3>
              <p className="mt-2 max-w-[13rem] text-sm leading-relaxed text-ink-soft">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const EXAM_SAMPLE = {
  stem: "A 67-year-old with heart failure presents with sudden breathlessness and bibasal crackles. Which finding most strongly suggests acute pulmonary oedema?",
  options: [
    { id: "A", text: "Dry mucous membranes" },
    { id: "B", text: "Pink, frothy sputum" },
    { id: "C", text: "Reduced jugular venous pressure" },
  ],
  correct: "B",
};

function ExamSection() {
  const [mode, setMode] = useState<"take" | "save">("take");
  const saving = mode === "save";

  return (
    <section id="exams" className="app-container scroll-mt-24">
      <div className="clay-card grid items-center gap-10 bg-card p-6 md:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:p-12">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-blue">
            <BookOpenText size={14} /> Your notes, examined
          </span>
          <h2 className="mt-5 font-display text-3xl font-black leading-tight md:text-4xl">
            Your notes. Now an <span className="text-blue">exam.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft md:text-lg">
            Upload your PDFs and slide decks. The Exam Generator reads all of it, maps every topic,
            and writes a comprehensive, source-grounded exam you can take at your own pace.
          </p>
          <ul className="mt-6 space-y-3">
            {EXAM_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-soft text-mint">
                  <CheckCircle2 size={16} strokeWidth={2.6} />
                </span>
                <span className="text-sm font-semibold leading-relaxed text-foreground md:text-base">
                  {b}
                </span>
              </li>
            ))}
          </ul>
          <div
            className="mt-6 inline-flex gap-1.5 rounded-full bg-muted p-1"
            role="group"
            aria-label="Exam Generator demo mode"
          >
            {(["take", "save"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-full px-4 py-2 text-xs font-black transition-colors ${
                  mode === m
                    ? "bg-blue text-foreground shadow-sm"
                    : "text-ink-soft hover:text-foreground"
                }`}
              >
                {m === "take" ? "Take the exam" : "Save to flashcards"}
              </button>
            ))}
          </div>
        </div>

        {/* Exam mock */}
        <div className="relative rounded-3xl bg-muted p-4 soft-inset md:p-5">
          <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-[10px] font-black text-muted-foreground">
            <span className="truncate">✦ Cardiovascular physiology · Question 12 / 86</span>
            <span className="hidden shrink-0 sm:inline">MCQ</span>
          </div>
          <div className="mt-3 rounded-2xl bg-background p-5 md:p-6">
            <h3 className="font-display text-base font-black leading-relaxed">
              {EXAM_SAMPLE.stem}
            </h3>
            <div className="mt-3 space-y-2">
              {EXAM_SAMPLE.options.map((o) => {
                const correct = o.id === EXAM_SAMPLE.correct;
                return (
                  <div
                    key={o.id}
                    className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs ${
                      correct && saving
                        ? "bg-mint-soft"
                        : correct
                          ? "bg-blue-soft ring-1 ring-blue"
                          : "bg-muted/60"
                    }`}
                  >
                    <span className="flex size-5 items-center justify-center rounded-full border-2 border-border text-[10px] font-black">
                      {o.id}
                    </span>
                    {o.text}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Source: Heart failure lecture · slide 28
            </p>
          </div>
          <div className="clay-card mt-3 bg-yellow-soft p-4 md:absolute md:-bottom-5 md:right-4 md:mt-0 md:max-w-[16rem]">
            <p className="flex items-center gap-2 font-display text-xs font-black">
              <span className="flex size-6 items-center justify-center rounded-lg bg-yellow text-foreground">
                <Layers3 size={14} />
              </span>
              {saving ? "Saved to flashcards" : "Add to flashcards"}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
              {saving
                ? "The question and answer are now in your deck, ready for spaced review after the exam."
                : "Keep any tricky question for later — one tap saves it to a deck."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressSection() {
  const bars: { label: string; pct: number; color: SoftColor }[] = [
    { label: "Anatomy", pct: 82, color: "lavender" },
    { label: "Physiology", pct: 69, color: "blue" },
    { label: "Pathology", pct: 47, color: "mint" },
  ];
  return (
    <section id="progress" className="app-container scroll-mt-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Dashboard mock */}
        <div className="clay-card order-2 bg-lavender-soft p-6 md:p-8 lg:order-1">
          <div className="clay-card bg-card p-5 md:p-6">
            <div className="flex items-center justify-between font-display text-base font-black">
              <span>✨ Your study snapshot</span>
              <TrendingUp size={18} className="text-pink" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-yellow-soft p-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Sessions this week
                </p>
                <p className="font-display text-3xl font-black">8</p>
              </div>
              <div className="rounded-2xl bg-mint-soft p-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Cards due today
                </p>
                <p className="font-display text-3xl font-black">12</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {bars.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-3 text-xs font-bold text-ink-soft"
                >
                  <span className="w-20 shrink-0">{b.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`block h-full rounded-full bg-${b.color}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-pink-soft p-3.5 text-xs font-bold text-foreground">
              🌱 Suggested next: revisit cardiovascular pathology
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] font-semibold text-muted-foreground">
            Illustrative dashboard data shown.
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <span className="text-xs font-black uppercase tracking-wider text-pink">
            Progress that actually helps
          </span>
          <h2 className="mt-3 font-display text-3xl font-black leading-tight md:text-4xl">
            See your growth.
            <br />
            <span className="text-lavender">Know your next move.</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft md:text-lg">
            Go beyond streaks and scores. Keep track of strengths, missed questions, case feedback
            and due cards — so your next study session has a purpose.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {[
              { icon: TrendingUp, label: "Topic progress" },
              { icon: Flame, label: "XP & levels" },
              { icon: Target, label: "Targeted review" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="clay-card inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-extrabold text-ink-soft"
              >
                <chip.icon size={14} className="text-pink" /> {chip.label}
              </span>
            ))}
          </div>
        </div>
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
              "radial-gradient(20rem 14rem at 14% 8%, #fff, transparent 60%), radial-gradient(22rem 16rem at 90% 92%, #fff, transparent 60%)",
          }}
        />
        <div className="relative">
          <h2 className="font-display text-3xl font-black leading-tight text-foreground md:text-5xl">
            Big dreams. Smarter study sessions.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-relaxed text-foreground/80 md:text-lg">
            Every confident decision starts with a little practice. Create your free account and
            start with this week's case.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-card text-base text-foreground hover:bg-card">
              <Link to="/register">
                Come study with Medley <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-foreground/10 text-base text-foreground hover:bg-foreground/15"
            >
              <Link to="/login">I already have an account</Link>
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
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-extrabold text-muted-foreground">
          {NAV_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-pink">
              {item.label}
            </a>
          ))}
          <Link to="/register" className="transition-colors hover:text-pink">
            Get started
          </Link>
        </nav>
      </div>
      <p className="pb-10 text-center text-xs leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} Medley. Made for curious minds and future healthcare pros.
        Medley is a learning aid, not a substitute for qualified clinical advice, supervision or
        validated guidance.
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
        <PillarStrip />
        <Features />
        <LearningLoop />
        <ExamSection />
        <ProgressSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
