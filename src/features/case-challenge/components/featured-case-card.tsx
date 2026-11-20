import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseSummary } from "../case-summary";
import { getFeaturedCase } from "../cases.functions";
import { PatientAvatar } from "./patient-avatar";

const AVATAR_SIZE = "!w-14 sm:!w-20";

/** The home screen's weekly case, loaded from the published case library. */
export function FeaturedCaseCard() {
  const navigate = useNavigate();
  // undefined while loading; null when no case is published.
  const [featured, setFeatured] = useState<CaseSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getFeaturedCase()
      .then((summary) => !cancelled && setFeatured(summary))
      .catch(() => !cancelled && setFeatured(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (featured === null) return null;

  return (
    <section
      className="clay-card overflow-hidden bg-lavender-soft p-5 md:p-6"
      aria-busy={!featured}
    >
      <span className="inline-flex rounded-full bg-card/75 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
        ✦ Weekly case
      </span>
      {!featured ? (
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-5">
          <span className={`${AVATAR_SIZE} aspect-square animate-pulse rounded-full bg-card/70`} />
          <span className="space-y-2">
            <span className="block h-7 w-2/3 animate-pulse rounded-xl bg-card/70" />
            <span className="block h-4 w-full animate-pulse rounded-xl bg-card/60" />
            <span className="block h-4 w-4/5 animate-pulse rounded-xl bg-card/60" />
          </span>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-5">
          <PatientAvatar
            patient={featured.patient}
            expression={featured.patient.initialExpression}
            respiratoryRate={featured.arrivalRespiratoryRate}
            decorative
            className={`${AVATAR_SIZE} mx-0 shrink-0`}
          />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft md:text-base">
              {featured.intro}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink-soft sm:text-xs">
              <span className="rounded-full bg-card/70 px-2.5 py-1">
                Level {featured.difficulty}
              </span>
              {featured.specialty.map((specialty) => (
                <span key={specialty} className="rounded-full bg-card/70 px-2.5 py-1">
                  {specialty}
                </span>
              ))}
            </div>
            <Button
              variant="lavender"
              className="mt-4"
              aria-label={`Start case: ${featured.title}`}
              onClick={() =>
                void navigate({ to: "/cases/$caseId", params: { caseId: featured.id } })
              }
            >
              Start case <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
