import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Download, ExternalLink, FileJson, Files, ShieldCheck } from "lucide-react";
import type { CaseAction, MedicalCase } from "@/features/case-challenge/schema";
import {
  copyToClipboard,
  downloadTextFile,
  exportFileName,
  inspectCase,
  summarizeCase,
  toTypeScriptModule,
} from "../drafts";
import { Badge, IssueList, SectionCard, StatTile, ToolButton, Toolbar } from "./studio-ui";

/* Read-only inspection of a case that ships in the bank. */

type AssetCheck = {
  id: string;
  filename: string;
  status: "checking" | "ok" | "missing" | "manifest";
};

function useAssetChecks(definition: MedicalCase): AssetCheck[] {
  const [checks, setChecks] = useState<AssetCheck[]>([]);
  useEffect(() => {
    let cancelled = false;
    const initial = definition.assets.map<AssetCheck>((asset) => ({
      id: asset.id,
      filename: asset.filename,
      status: "checking",
    }));
    setChecks(initial);
    if (!definition.assets.length) return;
    (async () => {
      let manifest: { id?: string; filename?: string }[] = [];
      try {
        const response = await fetch(`/cases/${definition.slug}/assets.manifest.json`, {
          cache: "no-store",
        });
        manifest = response.ok ? ((await response.json()) as typeof manifest) : [];
      } catch {
        manifest = [];
      }
      const results = await Promise.all(
        definition.assets.map(async (asset): Promise<AssetCheck> => {
          const entry = manifest.find((item) => item.id === asset.id);
          if (!entry || entry.filename !== asset.filename) {
            return { id: asset.id, filename: asset.filename, status: "manifest" };
          }
          try {
            const head = await fetch(`/cases/${definition.slug}/${asset.filename}`, {
              method: "HEAD",
              cache: "no-store",
            });
            return { id: asset.id, filename: asset.filename, status: head.ok ? "ok" : "missing" };
          } catch {
            return { id: asset.id, filename: asset.filename, status: "missing" };
          }
        }),
      );
      if (!cancelled) setChecks(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [definition]);
  return checks;
}

const TIER_TONE = {
  obvious: "info",
  buried: "accent",
  contradicting: "warn",
  red_herring: "bad",
  none: "neutral",
} as const;

export function ActionFlags({ action }: { action: CaseAction }) {
  return (
    <>
      <Badge tone={TIER_TONE[action.clueTier]}>{action.clueTier.replace("_", " ")}</Badge>
      {action.isKeyClue && <Badge tone="good">key clue</Badge>}
      {action.isCritical && <Badge tone="info">critical</Badge>}
      {action.harmful && <Badge tone="bad">harmful</Badge>}
      {action.immediateFailure && <Badge tone="bad">fatal</Badge>}
      {action.isUnnecessary && <Badge tone="warn">unnecessary</Badge>}
      {action.safeWhen && <Badge tone="accent">gated</Badge>}
      {action.variants?.length ? (
        <Badge tone="neutral">{action.variants.length} variants</Badge>
      ) : null}
    </>
  );
}

export function CaseInspector({
  definition,
  onDuplicate,
  onNotice,
}: {
  definition: MedicalCase;
  onDuplicate: () => void;
  onNotice: (message: string) => void;
}) {
  const issues = useMemo(() => inspectCase(definition), [definition]);
  const summary = useMemo(() => summarizeCase(definition), [definition]);
  const assetChecks = useAssetChecks(definition);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const assetProblems = assetChecks.filter((check) => check.status !== "ok").length;
  const actionById = new Map(definition.actions.map((action) => [action.id, action]));

  async function copyModule() {
    const ok = await copyToClipboard(toTypeScriptModule(definition));
    onNotice(ok ? "TypeScript module copied." : "Clipboard unavailable; use Download instead.");
  }

  return (
    <div className="space-y-5">
      <header className="clay-card bg-lavender-soft p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-ink-soft">{definition.slug}</p>
            <h2 className="mt-1 font-display text-2xl font-black md:text-3xl">
              {definition.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {definition.intro}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="neutral">Level {definition.difficulty}</Badge>
              <Badge tone={definition.reviewStatus === "clinician_reviewed" ? "good" : "warn"}>
                {definition.reviewStatus === "clinician_reviewed"
                  ? "clinician reviewed"
                  : "needs clinician review"}
              </Badge>
              {definition.specialty.map((item) => (
                <Badge key={item} tone="accent">
                  {item}
                </Badge>
              ))}
              <Badge tone="neutral">{definition.setting}</Badge>
            </div>
          </div>
          <Toolbar>
            <Link
              to="/cases/$caseId"
              params={{ caseId: definition.id }}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-black shadow-sm hover:bg-muted"
            >
              <ExternalLink className="size-4" /> Open in player
            </Link>
            <ToolButton onClick={onDuplicate} tone="primary">
              <Files className="size-4" /> Duplicate as draft
            </ToolButton>
          </Toolbar>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Validation"
          value={errors.length ? `${errors.length} errors` : "Passing"}
          tone={errors.length ? "bad" : "good"}
        />
        <StatTile
          label="Warnings"
          value={warnings.length}
          tone={warnings.length ? "warn" : "good"}
        />
        <StatTile
          label="Assets"
          value={
            definition.assets.length
              ? assetChecks.some((check) => check.status === "checking")
                ? "Checking…"
                : assetProblems
                  ? `${assetProblems} missing`
                  : `${definition.assets.length} ok`
              : "None"
          }
          tone={!definition.assets.length || assetProblems === 0 ? "good" : "bad"}
        />
        <StatTile label="Actions" value={definition.actions.length} />
      </div>

      <SectionCard
        title="Validation"
        description="The same checks `npm run validate:cases` runs, plus authoring quality warnings."
        badge={
          errors.length ? (
            <Badge tone="bad">{errors.length} errors</Badge>
          ) : (
            <Badge tone="good">ok</Badge>
          )
        }
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink-soft">
              Errors
            </h3>
            <IssueList issues={errors} />
          </div>
          {warnings.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink-soft">
                Warnings
              </h3>
              <IssueList issues={warnings} compact />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Assets"
        description={`Files under public/cases/${definition.slug}/ and their manifest entries.`}
        badge={<Badge tone="neutral">{definition.assets.length}</Badge>}
        defaultOpen={definition.assets.length > 0}
      >
        {definition.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This case uses generated ECGs and text results only; no image files are required.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {definition.assets.map((asset) => {
              const check = assetChecks.find((item) => item.id === asset.id);
              const status = check?.status ?? "checking";
              return (
                <li key={asset.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-bold">{asset.id}</span>
                    <span className="block text-sm font-semibold">{asset.filename}</span>
                    <span className="block text-xs text-muted-foreground">
                      {asset.license} · {asset.author}
                      {asset.isPlaceholder ? " · placeholder" : ""}
                    </span>
                  </span>
                  <Badge
                    tone={status === "ok" ? "good" : status === "checking" ? "neutral" : "bad"}
                  >
                    {status === "ok"
                      ? "file found"
                      : status === "checking"
                        ? "checking"
                        : status === "manifest"
                          ? "manifest mismatch"
                          : "file missing"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Structure"
        description="How the case is built: clue coverage, time pressure and the paths through it."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-muted p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink-soft">Actions</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {(["ask", "examine", "test", "treat"] as const).map((category) => (
                <div key={category} className="flex justify-between">
                  <dt className="capitalize text-muted-foreground">{category}</dt>
                  <dd className="font-black">{summary.actionsByCategory[category]}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Key clues</dt>
                <dd className="font-black">{summary.keyClues}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Harmful</dt>
                <dd className="font-black">{summary.harmful}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Unnecessary</dt>
                <dd className="font-black">{summary.unnecessary}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Safety-gated</dt>
                <dd className="font-black">{summary.gated}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">State variants</dt>
                <dd className="font-black">{summary.variants}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink-soft">
              Clue tiers
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["obvious", "buried", "contradicting", "red_herring", "none"] as const).map(
                (tier) => (
                  <Badge key={tier} tone={TIER_TONE[tier]}>
                    {tier.replace("_", " ")} · {summary.clueTiers[tier] ?? 0}
                  </Badge>
                ),
              )}
            </div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-wider text-ink-soft">
              Time pressure
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {definition.deteriorationRules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">
                    {actionById.get(rule.action)?.label ?? rule.action}
                  </span>
                  <span className="text-muted-foreground">
                    by min {rule.ifNotDoneBy}
                    {rule.lossAtMinute !== undefined ? ` · lost at ${rule.lossAtMinute}` : ""}
                  </span>
                </li>
              ))}
              {definition.deteriorationRules.length === 0 && (
                <li className="text-muted-foreground">No deterioration rules.</li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink-soft">
              Differential
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {definition.differential.map((diagnosis) => (
                <li key={diagnosis.id} className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{diagnosis.label}</span>
                  {diagnosis.isCorrect && <Badge tone="good">correct</Badge>}
                  {diagnosis.isTempting && <Badge tone="warn">tempting</Badge>}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink-soft">
              Key treatment
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {definition.solution.keyTreatment.map((id) => (
                <li key={id} className="font-semibold">
                  {actionById.get(id)?.label ?? id}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-xs font-black uppercase tracking-wider text-ink-soft">
              Hints
            </h3>
            <ol className="mt-2 space-y-1 text-sm">
              {definition.hints.map((hint) => (
                <li key={hint.tier} className="flex gap-2">
                  <span className="shrink-0 font-black">
                    {hint.tier} · {hint.cost}pt
                  </span>
                  <span className="text-muted-foreground">{hint.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <h3 className="mb-2 mt-5 text-xs font-black uppercase tracking-wider text-ink-soft">
          Every action
        </h3>
        <ul className="divide-y divide-border">
          {definition.actions.map((action) => (
            <li key={action.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <Badge tone="neutral">{action.category}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{action.label}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {action.id} · {action.timeCostMin} min · ${action.moneyCost}
                </span>
              </span>
              <span className="flex flex-wrap gap-1">
                <ActionFlags action={action} />
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Export"
        description="Use a shipped case as the starting point for a new one."
        defaultOpen={false}
      >
        <Toolbar>
          <ToolButton onClick={copyModule}>
            <Copy className="size-4" /> Copy TypeScript
          </ToolButton>
          <ToolButton
            onClick={() =>
              downloadTextFile(exportFileName(definition), toTypeScriptModule(definition))
            }
          >
            <Download className="size-4" /> Download .ts
          </ToolButton>
          <ToolButton
            onClick={() =>
              downloadTextFile(
                `${definition.slug}.json`,
                JSON.stringify(definition, null, 2),
                "application/json",
              )
            }
          >
            <FileJson className="size-4" /> Download JSON
          </ToolButton>
        </Toolbar>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Shipped cases are source code; edits happen in the repository and go through clinician
          review and `npm test` before release.
        </p>
      </SectionCard>
    </div>
  );
}
