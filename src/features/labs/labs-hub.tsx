import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FlaskConical,
  Microscope,
  PersonStanding,
  Pill,
  type LucideIcon,
} from "lucide-react";
import { ANATOMY_LAB_ENABLED } from "@/features/anatomy-lab/feature-flag";

type Lab = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Literal Tailwind classes (kept whole so the compiler sees them). */
  tint: string;
  /** Set when the lab is live; labs without a route render as "Coming soon". */
  to?: "/labs/anatomy" | undefined;
};

// Add a lab here (and its route under src/routes/labs.*.tsx) to make it live.
const LABS: Lab[] = [
  {
    id: "anatomy",
    title: "Anatomy Lab",
    description:
      "Explore an interactive 3D human body. Search structures, toggle systems, and isolate or explode the model.",
    icon: PersonStanding,
    tint: "bg-lavender-soft",
    to: ANATOMY_LAB_ENABLED ? "/labs/anatomy" : undefined,
  },
  {
    id: "pathology",
    title: "Pathology Lab",
    description: "Study disease processes, from the specimen to the slide.",
    icon: Microscope,
    tint: "bg-pink-soft",
  },
  {
    id: "pharmacology",
    title: "Pharmacology Lab",
    description: "See how drugs move through the body and where they act.",
    icon: Pill,
    tint: "bg-mint-soft",
  },
];

export function LabsHub() {
  return (
    <div>
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase text-ink-soft">
          <FlaskConical size={17} className="text-blue" />
          YOUR LABS
        </div>
        <h1 className="mt-3 font-display text-3xl font-black md:text-5xl">Labs</h1>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          Hands-on, interactive spaces for exploring the science behind medicine.
        </p>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LABS.map((lab) => (
          <li key={lab.id} className="flex">
            {lab.to ? <LiveLabCard lab={lab} to={lab.to} /> : <UpcomingLabCard lab={lab} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveLabCard({ lab, to }: { lab: Lab; to: NonNullable<Lab["to"]> }) {
  const Icon = lab.icon;
  return (
    <Link to={to} className={`clay-card flex w-full flex-col p-6 ${lab.tint}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-card/80 shadow-[inset_0_2px_1px_var(--card)]">
          <Icon size={26} strokeWidth={2.2} />
        </span>
        <span className="rounded-full bg-card/80 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
          Open
        </span>
      </div>
      <h2 className="mt-5 font-display text-2xl font-black">{lab.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{lab.description}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold">
        Enter lab <ArrowRight size={16} />
      </span>
    </Link>
  );
}

function UpcomingLabCard({ lab }: { lab: Lab }) {
  const Icon = lab.icon;
  return (
    <div className="flex w-full flex-col rounded-[24px] border-2 border-dashed border-border bg-card/60 p-6">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex size-14 items-center justify-center rounded-2xl text-ink-soft ${lab.tint}`}
        >
          <Icon size={26} strokeWidth={2.2} />
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          Coming soon
        </span>
      </div>
      <h2 className="mt-5 font-display text-2xl font-black text-ink-soft">{lab.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{lab.description}</p>
    </div>
  );
}
