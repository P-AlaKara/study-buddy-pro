import { MapPin, Stethoscope, Target, TriangleAlert, UserRound } from "lucide-react";
import { wardImageForCase } from "@/features/case-challenge/components/patient-media";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { initialVitals } from "../../case-analysis";
import { DIFFICULTY_META, EXPRESSION_META } from "../../vocabulary";
import { VitalsGrid } from "../clinical-display";
import { EditButton } from "../edit-button";
import { Panel, SubHeading, Tag, VisibilityTag } from "../studio-ui";

/** A visibility tag plus, when the case can be edited, an Edit button for the section. */
function Aside({
  visibility,
  edit,
}: {
  visibility: "students" | "debrief" | "reviewers";
  edit?: Parameters<typeof EditButton>[0]["target"] | undefined;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <VisibilityTag visibility={visibility} />
      {edit && <EditButton target={edit} />}
    </span>
  );
}

export function ReviewPatientStage({
  definition,
  readOnly = false,
}: {
  definition: MedicalCase;
  readOnly?: boolean;
}) {
  const { patient } = definition;
  const start = initialVitals(definition);
  const ward = wardImageForCase(definition);
  const correct = definition.differential.find((item) => item.isCorrect);
  const tempting = definition.differential.find((item) => item.isTempting);
  const others = definition.differential.filter((item) => !item.isCorrect && !item.isTempting);
  const difficulty = DIFFICULTY_META[definition.difficulty] ?? DIFFICULTY_META[2];
  // The read-only preview in the builder never offers edits.
  const at = (step: "basics" | "patient", anchor: string) =>
    readOnly ? undefined : { step, anchor };

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden p-0 md:p-0">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-1.5">
              {definition.specialty.map((item) => (
                <Tag key={item} tone="accent">
                  {item}
                </Tag>
              ))}
              <Tag>
                Level {definition.difficulty} · {difficulty.label}
              </Tag>
              {!readOnly && (
                <span className="ml-auto">
                  <EditButton
                    target={{ step: "basics", anchor: "studio-title" }}
                    label="Edit title & level"
                  />
                </span>
              )}
            </div>
            <h2 className="mt-3 font-display text-2xl font-black leading-tight md:text-3xl">
              {definition.title || "Untitled case"}
            </h2>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <UserRound aria-hidden className="size-4" />
                {patient.name || "Unnamed patient"}, {patient.age}, {patient.sex}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4" />
                {definition.setting || "Setting not set"}
              </span>
            </p>
            <figure className="mt-5">
              <figcaption className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-black uppercase tracking-[0.08em] text-ink-soft">
                  Opening scene
                </span>
                <VisibilityTag visibility="students" />
                {!readOnly && (
                  <EditButton
                    target={{ step: "patient", anchor: "studio-intro" }}
                    label="Edit patient & opening"
                  />
                )}
              </figcaption>
              <blockquote className="rounded-2xl border-l-4 border-[#7c63e0] bg-lavender-soft/60 px-4 py-3 font-display text-lg font-bold leading-relaxed">
                {definition.intro || (
                  <span className="italic text-[#8f2424]">No opening scene yet.</span>
                )}
              </blockquote>
            </figure>
          </div>
          <div className="relative min-h-48 bg-[#e9e2f1]">
            <img
              src={ward.src}
              srcSet={ward.srcSet}
              sizes="(min-width: 768px) 22rem, 100vw"
              alt={ward.alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `${ward.focus.x}% ${ward.focus.y}%` }}
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-extrabold text-white">
              Ward view students see · looks{" "}
              {EXPRESSION_META[patient.initialExpression].toLowerCase()}
            </span>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SubHeading
            aside={
              <Aside visibility="students" edit={at("patient", "studio-patient-chiefComplaint")} />
            }
          >
            Presenting complaint
          </SubHeading>
          <p className="text-[15px] font-bold leading-relaxed">
            {patient.chiefComplaint || (
              <span className="italic text-[#8f2424]">Not written yet.</span>
            )}
          </p>
          {patient.presentingTags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patient.presentingTags.map((tag) => (
                <Tag key={tag} tone="info">
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
          <div className="mt-5">
            <SubHeading
              aside={
                <Aside visibility="reviewers" edit={at("patient", "studio-patient-personality")} />
              }
            >
              How the patient speaks
            </SubHeading>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {patient.personality || "Not described."} Use this to judge whether the replies in
              History taking stay in character.
            </p>
          </div>
        </Panel>
        <Panel>
          <SubHeading aside={<Aside visibility="students" edit={at("patient", "studio-vitals")} />}>
            Observations on arrival
          </SubHeading>
          {start ? (
            <VitalsGrid vitals={start} />
          ) : (
            <p className="flex items-center gap-2 text-sm font-bold text-[#8f2424]">
              <TriangleAlert aria-hidden className="size-4" /> Arrival observations are missing or
              unreadable.
            </p>
          )}
          <p className="mt-3 text-[13px] text-muted-foreground">
            These start the case; the Patient timeline shows how they change.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SubHeading aside={<Aside visibility="debrief" edit={at("basics", "studio-teaching")} />}>
            <span className="inline-flex items-center gap-1.5">
              <Target aria-hidden className="size-4" /> Learning objectives
            </span>
          </SubHeading>
          <p className="mb-3 text-[13px] text-muted-foreground">
            The three teaching points students read in the debrief.
          </p>
          <ol className="space-y-2">
            {definition.solution.teachingPoints.map((point, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-2xl bg-muted/60 p-3 text-sm leading-relaxed"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#5a44b5] text-xs font-black text-white">
                  {index + 1}
                </span>
                <span>{point || <span className="italic text-[#8f2424]">Empty</span>}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <SubHeading
            aside={<Aside visibility="reviewers" edit={at("basics", "studio-differential")} />}
          >
            <span className="inline-flex items-center gap-1.5">
              <Stethoscope aria-hidden className="size-4" /> Diagnosis (revealed in the debrief)
            </span>
          </SubHeading>
          <dl className="space-y-3 text-sm">
            <div className="rounded-2xl bg-mint-soft p-3">
              <dt className="text-[13px] font-extrabold text-[#0b5f5c]">Correct answer</dt>
              <dd className="mt-0.5 text-[15px] font-black">
                {definition.solution.diagnosis || correct?.label || "Not set"}
              </dd>
              {correct &&
                definition.solution.diagnosis &&
                correct.label !== definition.solution.diagnosis && (
                  <dd className="mt-0.5 text-[13px] text-muted-foreground">
                    Listed for students as “{correct.label}”.
                  </dd>
                )}
            </div>
            <div className="rounded-2xl bg-yellow-soft p-3">
              <dt className="text-[13px] font-extrabold text-[#6b4f00]">Tempting wrong answer</dt>
              <dd className="mt-0.5 text-[15px] font-black">{tempting?.label ?? "Not set"}</dd>
              {definition.solution.whyNotTempting && (
                <dd className="mt-1 text-[13px] leading-relaxed">
                  <span className="font-bold">Why it's wrong (debrief):</span>{" "}
                  {definition.solution.whyNotTempting}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-[13px] font-extrabold text-muted-foreground">
                Other options students can pick
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {others.length
                  ? others.map((item) => <Tag key={item.id}>{item.label}</Tag>)
                  : "None"}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
