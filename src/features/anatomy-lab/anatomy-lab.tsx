import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ChevronRight,
  Focus,
  HeartPulse,
  Info,
  Layers3,
  Loader2,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ATLAS_MANIFEST_URL } from "./config";
import {
  DEFAULT_VISIBLE,
  EXPLANATIONS,
  SYSTEMS,
  explanation,
  type Atlas,
  type Concept,
  type SceneState,
  type SystemId,
  type View,
} from "./engine/anatomy";
import { AnatomyCredits } from "./credits";
import { AnatomyTour } from "./tour";
import "./anatomy-lab.css";

// The Three.js engine (and the `three` bundle) only loads once the atlas is ready,
// keeping it out of the initial route chunk.
const AnatomyScene = lazy(() => import("./engine/scene"));

const INITIAL: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: "three-quarter",
  rotate: false,
  reset: 0,
};

const DEFAULT_SUGGESTIONS = [
  "heart",
  "brain",
  "liver",
  "stomach",
  "spleen",
  "pancreas",
  "urinary bladder",
  "trachea",
];

const ORGAN_PRESET: SystemId[] = [
  "cardiac",
  "respiratory",
  "digestive",
  "urinary",
  "endocrine",
  "reproductive",
];

const VIEW_LABELS: Record<View, string> = {
  "three-quarter": "¾",
  front: "F",
  side: "S",
  back: "B",
};

export function AnatomyLab() {
  const searchInput = useRef<HTMLInputElement>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState<SceneState>(INITIAL);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [credits, setCredits] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isMobile = useIsMobile();

  // Load the catalogue manifest. Geometry chunks stream in separately inside the scene.
  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError("");
    setAtlas(null);
    setChosen(null);
    setState({ ...INITIAL, visible: DEFAULT_VISIBLE });
    fetch(ATLAS_MANIFEST_URL, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The anatomy catalogue could not be loaded.");
        return r.json();
      })
      .then((data) => setAtlas(data as Atlas))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [reloadKey]);

  // Press "/" to jump to the structure search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setMobilePanel(true);
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map((p) => [p.id, p])), [atlas]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SYSTEMS.map((s) => [s.id, atlas?.parts.filter((p) => p.system === s.id).length ?? 0]),
      ) as Record<SystemId, number>,
    [atlas],
  );
  const activeSystems = SYSTEMS.filter((s) => counts[s.id] > 0);
  const selectedParts = state.selected.map((id) => parts.get(id)).filter((p) => !!p);
  const selected = selectedParts[0];
  const system = SYSTEMS.find((s) => s.id === selected?.system);
  const visibleCount =
    atlas?.parts.filter((p) =>
      state.isolate
        ? state.selected.includes(p.id)
        : state.visible.includes(p.system) || state.selected.includes(p.id),
    ).length ?? 0;

  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.toLowerCase().trim();
    if (!term)
      return DEFAULT_SUGGESTIONS.map((name) =>
        atlas.concepts.find((c) => c.name.toLowerCase() === name),
      ).filter((x): x is Concept => !!x);
    return atlas.concepts
      .filter((c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term))
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 80);
  }, [atlas, query]);

  const detailOpen = selectedParts.length > 0;

  const choose = (c: Concept) => {
    setChosen(c);
    setState((s) => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    if (isMobile) setMobilePanel(false);
  };
  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (!p) return;
    setChosen({ id: p.conceptId, name: p.name, elements: [id] });
    setState((s) => ({ ...s, selected: [id], isolate: false, rotate: false }));
  };
  const toggleSystem = (id: SystemId) =>
    setState((s) => ({
      ...s,
      selected: [],
      isolate: false,
      visible: s.visible.includes(id) ? s.visible.filter((x) => x !== id) : [...s.visible, id],
    }));
  const soloSystem = (id: SystemId) =>
    setState((s) => ({ ...s, visible: [id], isolate: false, selected: [] }));
  const clearSelection = () => {
    setState((s) => ({ ...s, selected: [], isolate: false }));
    setChosen(null);
  };
  const reset = () => {
    setState((s) => ({ ...INITIAL, visible: DEFAULT_VISIBLE, reset: s.reset + 1 }));
    setChosen(null);
    setQuery("");
  };

  const caption = state.isolate
    ? (chosen?.name ?? "Selected structure")
    : state.explode > 0.95
      ? "Anatomical inventory"
      : state.explode > 0.05
        ? "Separated structures"
        : "Adult human · male";

  const allOn =
    activeSystems.length > 0 && activeSystems.every((x) => state.visible.includes(x.id));
  const skeletonOn = state.visible.length === 1 && state.visible[0] === "skeletal";
  const organsOn =
    state.visible.length === ORGAN_PRESET.length &&
    ORGAN_PRESET.every((id) => state.visible.includes(id));

  return (
    <div className="anatomy-lab">
      {atlas && (
        <Suspense fallback={null}>
          <AnatomyScene
            atlas={atlas}
            state={{ ...state, inspectorOpen: detailOpen }}
            onSelect={choosePart}
            onProgress={(n) => {
              setProgress(n);
              if (n === 100) setError("");
            }}
            onError={setError}
          />
        </Suspense>
      )}
      <div className="al-vignette" />

      {/* Top bar: Medley identity + feature actions (no duplicate main nav). */}
      <header className="identity">
        <div className="al-brand">
          <Link to="/" className="al-logo" aria-label="Back to Medley home">
            <span className="al-logo-mark">
              <HeartPulse size={21} strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">
              medley<span style={{ color: "var(--pink)" }}>.</span>
            </span>
          </Link>
          <div className="al-title">
            <div className="al-eyebrow">
              <span className="al-status-dot" /> Anatomy Lab
            </div>
            <h1>
              3D Explorer
              <Badge variant="outline" className="text-[10px]">
                BodyParts3D
              </Badge>
            </h1>
          </div>
        </div>
        <div className="al-topactions">
          <Button
            variant="secondary"
            size="sm"
            className="bg-card shadow-sm"
            onClick={() => setCredits(true)}
          >
            <Info size={16} />
            <span className="hidden sm:inline">Sources &amp; credits</span>
          </Button>
          <Button variant="secondary" size="icon" className="bg-card shadow-sm" asChild>
            <Link to="/" aria-label="Exit the Anatomy Lab">
              <X size={18} />
            </Link>
          </Button>
        </div>
      </header>

      {/* Left: search + anatomical systems */}
      {isMobile && mobilePanel && (
        <button
          type="button"
          className="al-scrim"
          aria-label="Close panel"
          onClick={() => setMobilePanel(false)}
        />
      )}
      <aside
        className={`al-left al-glass ${mobilePanel ? "mobile-open" : ""}`}
        aria-label="Anatomy navigation"
      >
        <div className="al-panel-head">
          <span>Explore anatomy</span>
          {isMobile ? (
            <button
              type="button"
              className="al-link-btn"
              onClick={() => setMobilePanel(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          ) : (
            <span className="al-count-pill">{activeSystems.length} systems</span>
          )}
        </div>

        <div className="al-search">
          <div className="al-search-field">
            <Search size={16} className="text-[color:var(--al-muted)]" />
            <input
              ref={searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search heart, femur, cranial nerve…"
              aria-label="Search named anatomical structures"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="al-link-btn"
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </div>
          <div className="al-results" role="listbox" aria-label="Search results">
            {results.length === 0 ? (
              <p className="al-empty">No structures match your search.</p>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={chosen?.id === c.id}
                  data-active={chosen?.id === c.id}
                  className="al-result"
                  onClick={() => choose(c)}
                >
                  <span className="al-result-name">{c.name}</span>
                  <span className="al-result-meta">
                    {c.elements.length} {c.elements.length === 1 ? "piece" : "pieces"}
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="al-empty" style={{ padding: "4px 2px 0", fontSize: 11 }}>
            {query
              ? "Showing up to 80 matches. Refine to find smaller structures."
              : "Jump to a major organ, or search every named structure."}
          </p>
        </div>

        <div className="al-section-label">Systems</div>
        <div className="al-presets">
          <button
            type="button"
            className="al-preset"
            aria-pressed={allOn}
            onClick={() =>
              setState((s) => ({
                ...s,
                selected: [],
                isolate: false,
                visible: activeSystems.map((x) => x.id),
              }))
            }
          >
            All
          </button>
          <button
            type="button"
            className="al-preset"
            aria-pressed={skeletonOn}
            onClick={() =>
              setState((s) => ({ ...s, selected: [], isolate: false, visible: ["skeletal"] }))
            }
          >
            Skeleton
          </button>
          <button
            type="button"
            className="al-preset"
            aria-pressed={organsOn}
            onClick={() =>
              setState((s) => ({ ...s, selected: [], isolate: false, visible: [...ORGAN_PRESET] }))
            }
          >
            Organs
          </button>
        </div>

        <div className="al-systems">
          {activeSystems.map((s) => (
            <div
              key={s.id}
              className={`al-system ${state.visible.includes(s.id) ? "enabled" : ""}`}
            >
              <button
                type="button"
                className="al-system-name"
                title={`Show only ${s.name.toLowerCase()}`}
                onClick={() => soloSystem(s.id)}
              >
                <span className="al-system-dot" style={{ background: s.color }} />
                {s.name}
                <span className="al-system-count">{counts[s.id]}</span>
              </button>
              <Switch
                checked={state.visible.includes(s.id)}
                onCheckedChange={() => toggleSystem(s.id)}
                aria-label={`Show ${s.name.toLowerCase()}`}
              />
            </div>
          ))}
        </div>

        <div className="al-panel-foot">
          <span>{visibleCount.toLocaleString()} pieces visible</span>
          <button
            type="button"
            className="al-link-btn"
            onClick={() => setState((s) => ({ ...s, visible: [], selected: [], isolate: false }))}
          >
            Hide all
          </button>
        </div>
      </aside>

      {/* Camera / view controls */}
      <nav className="al-viewcontrols al-glass" aria-label="Camera controls">
        {(["three-quarter", "front", "side", "back"] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            className={state.view === v ? "active" : ""}
            aria-pressed={state.view === v}
            aria-label={`${v} view`}
            title={`${v} view`}
            disabled={state.explode > 0.8 && v !== "front"}
            onClick={() => setState((s) => ({ ...s, view: v, reset: s.reset + 1, rotate: false }))}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
        <span className="al-divider" />
        <button
          type="button"
          className={state.rotate ? "active" : ""}
          disabled={state.explode >= 0.4}
          aria-label={state.rotate ? "Pause rotation" : "Auto-rotate"}
          title="Auto-rotate"
          onClick={() => setState((s) => ({ ...s, rotate: !s.rotate }))}
        >
          {state.rotate ? <Pause size={17} /> : <RotateCw size={18} />}
        </button>
        <button type="button" aria-label="Reset view and systems" title="Reset" onClick={reset}>
          <RotateCcw size={17} />
        </button>
      </nav>

      <div className="al-caption">
        <span className="al-caption-line" />
        <span>{caption}</span>
        <span className="al-caption-line" />
      </div>

      {/* Bottom dock: exploded view */}
      <div className="al-dock al-glass">
        <button
          type="button"
          className="al-dock-mobile-btn"
          onClick={() => setMobilePanel((o) => !o)}
          aria-label="Open anatomy navigation"
        >
          <Layers3 size={20} />
          <span>Systems</span>
        </button>
        <div className="al-explode">
          <div className="al-explode-label">
            <label id="al-explode-label">Explode anatomy</label>
            <output>
              {Math.round(state.explode * 100)}
              <span>%</span>
            </output>
          </div>
          <Slider
            aria-labelledby="al-explode-label"
            min={0}
            max={100}
            step={1}
            value={[state.explode * 100]}
            onValueChange={(v) => {
              const next = (Array.isArray(v) ? (v[0] ?? 0) : v) / 100;
              setState((s) => ({
                ...s,
                explode: next,
                view: next > 0.8 ? "front" : s.view,
                rotate: false,
              }));
            }}
          />
          <div className="al-slider-ends">
            <span>Assembled</span>
            <span>Every piece</span>
          </div>
        </div>
        <button
          type="button"
          className="al-dock-reset"
          onClick={reset}
          aria-label="Assemble and reset"
        >
          <RotateCcw size={18} />
          <span>Reset</span>
        </button>
      </div>

      <div className="al-hint">
        {state.explode > 0.8 ? "Drag to pan" : "Drag to orbit"}
        <b>·</b>Pinch or scroll to zoom<b>·</b>Tap a structure to inspect
      </div>

      {/* Right: selected structure details */}
      {detailOpen && (
        <aside className="detail-sheet al-glass" aria-label="Selected structure">
          <button
            type="button"
            className="detail-close"
            onClick={clearSelection}
            aria-label="Close details"
          >
            <X size={17} />
          </button>
          <div className="detail-header">
            <div className="detail-accent" style={{ background: system?.color }} />
            <div className="al-eyebrow">{system?.name ?? "Anatomy"}</div>
            <h2 className="structure-title">{chosen?.name}</h2>
          </div>
          <div className="detail-scroll">
            <p className="structure-description">
              {chosen && selected ? explanation(chosen.name, selected.system) : ""}
            </p>
            {chosen && !EXPLANATIONS[chosen.name.toLowerCase()] && (
              <span className="context-note">
                System overview · structure identified from source anatomy
              </span>
            )}
            <div className="structure-meta">
              <span>
                Atlas reference
                <strong>{chosen?.id}</strong>
              </span>
              <span>
                Selected pieces
                <strong>{state.selected.length.toLocaleString()}</strong>
              </span>
            </div>
            {selectedParts.length > 1 && (
              <div className="member-list">
                <h3>Included structures</h3>
                {selectedParts.slice(0, 50).map((p) => (
                  <button key={p.id} type="button" onClick={() => choosePart(p.id)}>
                    <span>{p.name}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {selectedParts.length > 50 && (
                  <p className="member-note">
                    And {selectedParts.length - 50} more modeled pieces.
                  </p>
                )}
              </div>
            )}
            <a
              className="source-link"
              href="https://lifesciencedb.jp/bp3d/"
              target="_blank"
              rel="noreferrer"
            >
              View anatomical source <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="detail-actions">
            <Button
              variant={state.isolate ? "default" : "outline"}
              onClick={() => setState((s) => ({ ...s, isolate: !s.isolate, explode: 0 }))}
            >
              <Focus size={18} />
              {state.isolate ? "Show surrounding anatomy" : "Isolate structure"}
              <ChevronRight size={16} className="ml-auto" />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        </aside>
      )}

      {/* Loading / error */}
      {!error && (progress < 100 || !atlas) && (
        <div className="al-status al-glass" role="status">
          <Loader2 size={20} className="al-spin" />
          <div>
            <strong>Preparing the anatomy</strong>
            <span>
              {atlas
                ? `${progress}% · Loading ${atlas.parts.length.toLocaleString()} pieces`
                : null}
              {!atlas ? "Loading the anatomy catalogue…" : null}
            </span>
            <div className="al-track">
              <i style={{ width: `${atlas ? progress : 6}%` }} />
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="al-status al-glass error" role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              setReloadKey((k) => k + 1);
            }}
          >
            <RotateCcw size={15} /> Try again
          </Button>
        </div>
      )}

      <AnatomyCredits open={credits} onOpenChange={setCredits} atlas={atlas} />
      {atlas && !error && (
        <AnatomyTour
          onOpenSearch={() => {
            setMobilePanel(true);
            searchInput.current?.focus();
          }}
        />
      )}
    </div>
  );
}

export default AnatomyLab;
