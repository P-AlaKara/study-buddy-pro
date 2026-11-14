import { useEffect, useRef } from "react";
import { ecgSample, plethSample, respirationSample, trendSample } from "./vital-waveforms.js";

export type TraceKind = "ecg" | "pleth" | "resp" | "trend";

interface TraceProps {
  kind: TraceKind;
  color: string;
  /** Beats or breaths per minute, from the case engine (ignored for trends). */
  rate?: number | undefined;
  /** Recorded readings, oldest first (trends only). */
  readings?: readonly number[] | undefined;
  /** Smallest value range a trend is drawn across, so tiny changes stay small. */
  minSpan?: number | undefined;
  /** Seconds for the write head to cross the trace; 0 draws it once, still. */
  sweepSeconds: number;
  className?: string;
}

/** Vertical value range each shape is drawn across (normalised units). */
const RANGE: Record<TraceKind, [number, number]> = {
  ecg: [-0.32, 1.05],
  pleth: [0, 1.12],
  resp: [-0.08, 1.08],
  trend: [-0.1, 1.1],
};

const FRAME_MS = 1000 / 30; // a monitor trace does not need 60 fps
const MORPH_MS = 700;

/* One shared requestAnimationFrame loop for every visible trace. It only
   runs while at least one trace is subscribed, so hidden, off-screen and
   reduced-motion traces cost nothing. */
type Tick = (now: number) => void;
const subscribers = new Set<Tick>();
let frame = 0;
function loop(now: number) {
  for (const tick of subscribers) tick(now);
  frame = subscribers.size > 0 ? requestAnimationFrame(loop) : 0;
}
function subscribe(tick: Tick): () => void {
  subscribers.add(tick);
  if (!frame) frame = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0 && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A bedside-monitor trace on a canvas. Physiological signals (ECG, pleth,
 * respiration) are drawn by a write head sweeping left to right, erasing the
 * previous sweep just ahead of it, at a cycle length taken from the live
 * vitals. Trends plot recorded readings and either glide a slow sweep across
 * them (BP) or hold still (temperature), easing to the new shape when a
 * reading changes. With reduced motion every trace is drawn once, still.
 */
export function VitalTrace({
  kind,
  color,
  rate = 0,
  readings,
  minSpan = 1,
  sweepSeconds,
  className = "",
}: TraceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props, read by the long-lived drawing loop without restarting it.
  const live = useRef({ kind, color, rate, readings, minSpan, sweepSeconds });
  live.current = { kind, color, rate, readings, minSpan, sweepSeconds };
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0; // columns, one per CSS pixel
    let height = 0;
    let dpr = 1;
    let columns: Float32Array = new Float32Array(0); // NaN = nothing drawn there
    let head = 0; // fractional column of the write head
    let signalClock = 0; // seconds into the current beat / breath
    let lastNow = 0;
    let lastDraw = 0;
    let reduced = prefersReducedMotion();
    let visible = true;
    let unsubscribe: (() => void) | null = null;
    // Trend easing: from the previous curve to the new one.
    let trendFrom: Float32Array | null = null;
    let trendTo: Float32Array = new Float32Array(0);
    let morphStart = 0;

    const isTrend = () => live.current.kind === "trend";
    const cycleSeconds = () => (live.current.rate > 0 ? 60 / live.current.rate : 0);
    const gapColumns = () => Math.max(6, Math.round(width * 0.07));

    const advance = (step: number, cycle: number) => {
      signalClock += step;
      while (signalClock >= cycle) signalClock -= cycle;
    };

    /** Next sample of a physiological signal, `step` seconds after the last. */
    const nextSample = (step: number): number => {
      const cycle = cycleSeconds();
      const { kind: k } = live.current;
      if (cycle === 0) return k === "pleth" ? 0.08 : 0; // no pulse / apnoea: flat line
      if (k === "ecg") {
        // One column spans ~30 ms but a QRS lasts ~90 ms with a far sharper
        // R peak, so keep the largest deflection inside the column (peak
        // detection, as real monitors do) rather than a single point sample.
        const parts = Math.min(24, Math.max(1, Math.ceil(step / 0.002)));
        let peak = 0;
        for (let i = 0; i < parts; i++) {
          advance(step / parts, cycle);
          const v = ecgSample(signalClock, cycle);
          if (Math.abs(v) > Math.abs(peak)) peak = v;
        }
        return peak;
      }
      advance(step, cycle);
      if (k === "pleth") return plethSample(signalClock, cycle);
      return respirationSample(signalClock, cycle);
    };

    const computeTrend = (): Float32Array => {
      const out = new Float32Array(width);
      const values = live.current.readings ?? [];
      for (let c = 0; c < width; c++) {
        out[c] = trendSample(values, width > 1 ? c / (width - 1) : 0, live.current.minSpan);
      }
      return out;
    };

    /** Fill the whole trace at once, as if it had been running already. */
    const prefill = () => {
      columns = new Float32Array(width);
      if (isTrend()) {
        trendTo = computeTrend();
        trendFrom = null;
        columns.set(trendTo);
      } else {
        const step = (live.current.sweepSeconds || 2.5) / Math.max(width, 1);
        for (let c = 0; c < width; c++) columns[c] = nextSample(step);
      }
      // Signals: the next sample goes in column 0, continuing straight on
      // from the newest prefilled one at the right-hand edge.
      head = isTrend() ? 0 : Math.max(width - 1, 0);
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (width < 2 || height < 2) return;
      const [lo, hi] = RANGE[live.current.kind];
      const pad = 2.5;
      const toY = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad);
      const animated = !reduced && live.current.sweepSeconds > 0;
      const headColumn = Math.floor(head) % width;
      const gap = gapColumns();
      const inGap = (c: number) =>
        animated && isTrend() && (c - headColumn + width) % width < gap && c !== headColumn;

      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = live.current.color;
      ctx.shadowColor = live.current.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      let pen = false;
      for (let c = 0; c < width; c++) {
        const v = columns[c]!;
        if (Number.isNaN(v) || inGap(c)) {
          pen = false;
          continue;
        }
        const y = toY(v);
        if (pen) ctx.lineTo(c + 0.5, y);
        else ctx.moveTo(c + 0.5, y);
        pen = true;
        // Never join the newest column to the oldest one across the head.
        if (animated && c === headColumn) pen = false;
      }
      ctx.stroke();

      if (animated) {
        const v = columns[headColumn]!;
        if (!Number.isNaN(v)) {
          ctx.shadowBlur = 8;
          ctx.fillStyle = live.current.color;
          ctx.beginPath();
          ctx.arc(headColumn + 0.5, toY(v), 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    };

    const tick: Tick = (now) => {
      if (!lastNow) lastNow = now;
      const dt = Math.min((now - lastNow) / 1000, 0.1);
      lastNow = now;
      const sweep = live.current.sweepSeconds;

      if (isTrend()) {
        if (trendFrom) {
          const k = Math.min((now - morphStart) / MORPH_MS, 1);
          const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          for (let c = 0; c < width; c++) {
            columns[c] = trendFrom[c]! + (trendTo[c]! - trendFrom[c]!) * eased;
          }
          if (k >= 1) trendFrom = null;
        }
        if (sweep > 0) head = (head + (dt / sweep) * width) % width;
      } else if (sweep > 0 && width > 0) {
        const step = sweep / width;
        const target = head + dt / step;
        const gap = gapColumns();
        for (let c = Math.floor(head) + 1; c <= Math.floor(target); c++) {
          const column = c % width;
          columns[column] = nextSample(step);
          for (let g = 1; g <= gap; g++) columns[(column + g) % width] = Number.NaN;
        }
        head = target % width;
      }

      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        draw();
      }
      // A still trend only needs frames while it is easing to a new shape.
      if (isTrend() && sweep === 0 && !trendFrom) syncLoop();
    };

    const shouldRun = () =>
      visible && !reduced && width > 0 && (live.current.sweepSeconds > 0 || trendFrom !== null);

    function syncLoop() {
      const run = shouldRun();
      if (run && !unsubscribe) {
        lastNow = 0;
        unsubscribe = subscribe(tick);
      } else if (!run && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }

    const resize = () => {
      const nextWidth = Math.round(canvas.clientWidth);
      const nextHeight = Math.round(canvas.clientHeight);
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      prefill();
      draw();
      syncLoop();
    };

    // Called when the vitals change (see the effect below).
    refreshRef.current = () => {
      if (isTrend()) {
        const next = computeTrend();
        if (reduced || width === 0) {
          trendTo = next;
          columns.set(next);
          draw();
        } else {
          trendFrom = Float32Array.from(columns);
          trendTo = next;
          morphStart = performance.now();
          syncLoop();
        }
      } else if (reduced) {
        // Still trace: redraw it at the new rate.
        signalClock = 0;
        prefill();
        draw();
      }
      // Animated signals pick the new rate up on the next beat by themselves.
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      syncLoop();
    });
    intersection.observe(canvas);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reduced = motionQuery.matches;
      prefill();
      draw();
      syncLoop();
    };
    motionQuery.addEventListener("change", onMotionChange);
    resize();

    return () => {
      resizeObserver.disconnect();
      intersection.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      unsubscribe?.();
      refreshRef.current = () => {};
    };
  }, []);

  const readingsKey = readings?.join(",") ?? "";
  useEffect(() => {
    refreshRef.current();
  }, [rate, readingsKey, color]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
