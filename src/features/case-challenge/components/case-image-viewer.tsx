import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LocateFixed, Minus, Move, Plus, RotateCcw } from "lucide-react";
import type { CaseActionResult, CaseAsset } from "../schema.js";

interface FindingMark {
  x: number;
  y: number;
  label: string;
}

export function CaseImageViewer({
  asset,
  assetPath,
  result,
  revealAnswer = false,
}: {
  asset: CaseAsset;
  assetPath: string;
  result: CaseActionResult;
  revealAnswer?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [markMode, setMarkMode] = useState(false);
  const [mark, setMark] = useState<FindingMark | null>(null);
  const [label, setLabel] = useState("");
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  function reset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setMarkMode(false);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (markMode || zoom === 1) return;
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan({
      x: drag.current.panX + event.clientX - drag.current.x,
      y: drag.current.panY + event.clientY - drag.current.y,
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function placeMark(event: ReactPointerEvent<HTMLDivElement>) {
    if (!markMode) return;
    const box = event.currentTarget.getBoundingClientRect();
    setMark({
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
      label: label.trim() || "My finding",
    });
    setMarkMode(false);
  }

  const answer = result.annotation;

  return (
    <figure className="overflow-hidden rounded-[22px] bg-[#151f29] text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#22303c] px-3 py-2">
        <div className="flex items-center gap-1" aria-label="Image controls">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
            className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-12 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Reset image"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <button
          type="button"
          aria-pressed={markMode}
          onClick={() =>
            setMarkMode((value) => {
              if (!value) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }
              return !value;
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${markMode ? "bg-cyan-300 text-slate-950" : "bg-white/10"}`}
        >
          <LocateFixed className="size-4" /> Mark finding
        </button>
      </div>

      <div
        className={`relative aspect-[4/3] touch-none overflow-hidden ${markMode ? "cursor-crosshair" : zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={placeMark}
      >
        <div
          className="absolute inset-0 transition-transform duration-150"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <img
            src={assetPath}
            alt={asset.altText}
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
          {mark && (
            <span
              className="absolute z-10 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-cyan-300 bg-cyan-300/25 shadow-[0_0_0_4px_rgb(0_0_0/30%)]"
              style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
              title={mark.label}
            >
              <span className="sr-only">Your marked finding: {mark.label}</span>
            </span>
          )}
          {revealAnswer && answer && (
            <span
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300 bg-amber-300/15"
              style={{
                left: `${answer.xPercent}%`,
                top: `${answer.yPercent}%`,
                width: `${answer.radiusPercent * 2}%`,
                aspectRatio: "1",
              }}
              title={answer.label}
            >
              <span className="sr-only">Answer: {answer.label}</span>
            </span>
          )}
        </div>
        {zoom > 1 && !markMode && (
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold">
            <Move className="size-3" /> Drag to pan
          </span>
        )}
      </div>

      <div className="space-y-2 bg-[#22303c] px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Describe what you see…"
            aria-label="Finding label"
            className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/55 focus:ring-2 focus:ring-cyan-300"
          />
          {mark && (
            <button
              type="button"
              onClick={() => setMark(null)}
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Clear mark
            </button>
          )}
        </div>
        <figcaption className="text-[11px] leading-relaxed text-white/65">
          {asset.requiredAttributionText}
          {asset.sourceUrl && (
            <>
              {" "}
              <a
                href={asset.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Source
              </a>
            </>
          )}
        </figcaption>
      </div>
    </figure>
  );
}
