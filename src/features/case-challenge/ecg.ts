/**
 * Deterministic 12-lead ECG generator.
 *
 * Case ECGs are drawn here instead of being shipped as fixed images, so the
 * tracing a student orders always matches the patient's live heart rate and
 * clinical state (e.g. right-ventricular strain appearing as a PE worsens, or
 * low voltage and alternans once a dissection bleeds into the pericardium).
 *
 * Each beat is a sum of Gaussian waves (P, Q, R, S, R', ST, T) whose timing
 * scales with the RR interval. Limb leads are derived from I and III with
 * Einthoven's law so the six frontal leads always agree with each other. The
 * output is a print-style SVG: 3×4 layout plus a lead II rhythm strip on
 * standard paper (25 mm/s, 10 mm/mV), at a 4:3 aspect ratio to fill the case
 * image viewer exactly. Pure TypeScript: no DOM, so it runs in tests too.
 */
import type { EcgPreset, EcgTracing } from "./schema.js";

export type EcgLead =
  "I" | "II" | "III" | "aVR" | "aVL" | "aVF" | "V1" | "V2" | "V3" | "V4" | "V5" | "V6";

/** Wave amplitudes in mV for one lead. */
interface LeadMorphology {
  p: number;
  /** Late negative P component (biphasic P in V1). */
  p2?: number;
  q: number;
  r: number;
  s: number;
  /** Secondary R wave (RSR' of right bundle branch block). */
  r2?: number;
  /** ST-segment shift (negative = depression). */
  st?: number;
  t: number;
}

type PrecordialLead = "V1" | "V2" | "V3" | "V4" | "V5" | "V6";

interface PresetDefinition {
  /** Frontal plane: only I and III are authored; the rest are derived. */
  I: LeadMorphology;
  III: LeadMorphology;
  precordial: Record<PrecordialLead, LeadMorphology>;
  /** QRS width multiplier (1 = ~88 ms). */
  qrsWidth: number;
  /** Multiplies every QRS amplitude (low-voltage states). */
  qrsScale?: number;
  /** Multiplies P and T amplitudes. */
  ptScale?: number;
  /** Beat-to-beat QRS amplitude swing (electrical alternans), 0–1. */
  alternans?: number;
  /** Plain-language summary used for alt text. */
  summary: string;
}

const NORMAL_PRECORDIAL: Record<PrecordialLead, LeadMorphology> = {
  V1: { p: 0.06, p2: -0.04, q: 0, r: 0.18, s: -0.95, t: -0.05 },
  V2: { p: 0.07, q: 0, r: 0.35, s: -1.35, t: 0.45 },
  V3: { p: 0.07, q: 0, r: 0.75, s: -0.85, t: 0.45 },
  V4: { p: 0.07, q: 0, r: 1.25, s: -0.45, t: 0.4 },
  V5: { p: 0.07, q: -0.06, r: 1.35, s: -0.2, t: 0.32 },
  V6: { p: 0.07, q: -0.06, r: 1.1, s: -0.12, t: 0.26 },
};

const LVH_STRAIN: PresetDefinition = {
  I: { p: 0.09, q: -0.03, r: 1.35, s: -0.06, st: -0.07, t: -0.16 },
  III: { p: 0.03, q: 0, r: 0.22, s: -0.72, st: 0.03, t: 0.14 },
  precordial: {
    V1: { p: 0.07, p2: -0.07, q: 0, r: 0.22, s: -2.1, st: 0.12, t: 0.28 },
    V2: { p: 0.08, q: 0, r: 0.4, s: -2.55, st: 0.14, t: 0.45 },
    V3: { p: 0.08, q: 0, r: 0.9, s: -1.45, st: 0.05, t: 0.3 },
    V4: { p: 0.08, q: 0, r: 1.75, s: -0.6, st: -0.03, t: 0.08 },
    V5: { p: 0.08, q: -0.05, r: 2.55, s: -0.2, st: -0.12, t: -0.24 },
    V6: { p: 0.08, q: -0.05, r: 2.15, s: -0.1, st: -0.1, t: -0.22 },
  },
  qrsWidth: 1.15,
  summary:
    "left ventricular hypertrophy by voltage criteria with lateral ST depression and T-wave inversion (strain pattern); no regional ST elevation",
};

const PRESETS: Record<EcgPreset, PresetDefinition> = {
  sinus_normal: {
    I: { p: 0.08, q: -0.04, r: 0.75, s: -0.12, t: 0.22 },
    III: { p: 0.05, q: -0.03, r: 0.45, s: -0.12, t: 0.08 },
    precordial: NORMAL_PRECORDIAL,
    qrsWidth: 1,
    summary: "normal axis, intervals and ST segments",
  },
  pe_early: {
    I: { p: 0.07, q: 0, r: 0.55, s: -0.28, t: 0.2 },
    III: { p: 0.07, q: -0.06, r: 0.5, s: -0.08, t: 0.02 },
    precordial: {
      ...NORMAL_PRECORDIAL,
      V1: { p: 0.07, p2: -0.04, q: 0, r: 0.2, s: -0.9, t: -0.14 },
      V2: { p: 0.07, q: 0, r: 0.35, s: -1.2, t: 0.1 },
    },
    qrsWidth: 1,
    summary: "subtle T-wave inversion in V1 only; no ST elevation",
  },
  pe_rv_strain: {
    I: { p: 0.06, q: 0, r: 0.38, s: -0.48, t: 0.16 },
    III: { p: 0.09, q: -0.22, r: 0.55, s: -0.05, t: -0.22 },
    precordial: {
      V1: { p: 0.08, p2: -0.05, q: 0, r: 0.22, s: -0.38, r2: 0.48, t: -0.32 },
      V2: { p: 0.08, q: 0, r: 0.38, s: -1.0, r2: 0.12, t: -0.34 },
      V3: { p: 0.08, q: 0, r: 0.62, s: -0.85, t: -0.26 },
      V4: { p: 0.08, q: 0, r: 0.95, s: -0.55, t: -0.1 },
      V5: { p: 0.08, q: -0.03, r: 1.15, s: -0.38, t: 0.18 },
      V6: { p: 0.08, q: -0.02, r: 0.95, s: -0.32, t: 0.18 },
    },
    qrsWidth: 1.1,
    summary:
      "an S1Q3T3 pattern, rightward axis, incomplete right bundle branch block and T-wave inversion in V1 to V4 (right ventricular strain)",
  },
  lvh_strain: LVH_STRAIN,
  lvh_effusion: {
    ...LVH_STRAIN,
    qrsScale: 0.4,
    ptScale: 0.6,
    alternans: 0.2,
    summary:
      "QRS voltages much lower than expected for his hypertrophy, with beat-to-beat electrical alternans; no regional ST elevation",
  },
};

// ---------------------------------------------------------------------------
// Layout (millimetres; 4 SVG units per mm)

const UNIT = 4;
const PAGE_W = 268;
const PAGE_H = 201;
const GRID = { x0: 4, x1: 264, y0: 14, y1: 194 };
const TRACE_X0 = 12;
const MM_PER_S = 25;
const MM_PER_MV = 10;
const SECONDS = 10;
const COLUMN_SECONDS = 2.5;
const ROW_BASELINES = [39, 84, 129, 174];
const SAMPLE_HZ = 200;

const LAYOUT: EcgLead[][] = [
  ["I", "aVR", "V1", "V4"],
  ["II", "aVL", "V2", "V5"],
  ["III", "aVF", "V3", "V6"],
];

function leadCentre(lead: EcgLead | "rhythm"): { x: number; y: number } {
  if (lead === "rhythm") {
    return { x: TRACE_X0 + (SECONDS * MM_PER_S) / 2, y: ROW_BASELINES[3] ?? 0 };
  }
  for (let row = 0; row < LAYOUT.length; row += 1) {
    const col = LAYOUT[row]?.indexOf(lead) ?? -1;
    if (col >= 0) {
      return {
        x: TRACE_X0 + (col + 0.5) * COLUMN_SECONDS * MM_PER_S,
        y: ROW_BASELINES[row] ?? 0,
      };
    }
  }
  return { x: PAGE_W / 2, y: PAGE_H / 2 };
}

/**
 * An answer ring for the case image viewer, centred on the given leads (the
 * mean of their panel centres). Coordinates are percentages of the 4:3 page.
 */
export function ecgAnnotation(
  leads: Array<EcgLead | "rhythm">,
  radiusPercent: number,
  label: string,
): { xPercent: number; yPercent: number; radiusPercent: number; label: string } {
  const centres = leads.map(leadCentre);
  const x = centres.reduce((sum, c) => sum + c.x, 0) / centres.length;
  const y = centres.reduce((sum, c) => sum + c.y, 0) / centres.length;
  return {
    xPercent: Math.round((x / PAGE_W) * 1000) / 10,
    yPercent: Math.round((y / PAGE_H) * 1000) / 10,
    radiusPercent,
    label,
  };
}

// ---------------------------------------------------------------------------
// Signal model

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gauss(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function asymGauss(x: number, mu: number, left: number, right: number): number {
  return gauss(x, mu, x < mu ? left : right);
}

interface BeatTiming {
  tPeak: number;
  tLeft: number;
  tRight: number;
}

function timingFor(rr: number): BeatTiming {
  const root = Math.sqrt(rr);
  // QT ≈ 400 ms at 60 bpm, shortening to ≈ 290 ms at 135 bpm.
  return {
    tPeak: Math.max(0.15, 0.245 * root),
    tLeft: 0.055 * root + 0.012,
    tRight: 0.04 * root + 0.01,
  };
}

/** Voltage (mV) of one lead at `dt` seconds from an R peak. */
function beatVoltage(
  morph: LeadMorphology,
  dt: number,
  timing: BeatTiming,
  width: number,
  qrsGain: number,
  ptGain: number,
): number {
  if (dt < -0.32 || dt > timing.tPeak + 0.3) return 0;
  let v = 0;
  v += ptGain * morph.p * gauss(dt, -0.158, 0.022);
  if (morph.p2) v += ptGain * morph.p2 * gauss(dt, -0.118, 0.018);
  v += qrsGain * morph.q * gauss(dt, -0.026 * width, 0.007 * width);
  v += qrsGain * morph.r * gauss(dt, 0, 0.01 * width);
  v += qrsGain * morph.s * gauss(dt, 0.026 * width, 0.009 * width);
  if (morph.r2) v += qrsGain * morph.r2 * gauss(dt, 0.06 * width, 0.01 * width);
  if (morph.st) {
    const j = 0.045 * width;
    v +=
      ptGain *
      morph.st *
      0.5 *
      (Math.tanh((dt - j) / 0.008) - Math.tanh((dt - timing.tPeak) / 0.035));
  }
  v += ptGain * morph.t * asymGauss(dt, timing.tPeak, timing.tLeft, timing.tRight);
  return v;
}

interface RenderedLeads {
  samples: Record<EcgLead, Float64Array>;
  intervals: { prMs: number; qrsMs: number; qtMs: number; qtcMs: number };
}

function synthesise(preset: PresetDefinition, heartRate: number, seed: number): RenderedLeads {
  const random = mulberry32(seed);
  const rr = 60 / heartRate;
  const timing = timingFor(rr);
  const count = SECONDS * SAMPLE_HZ;

  // Beat times with mild sinus arrhythmia, extended past both edges so waves
  // from off-screen beats still bleed into the strip.
  const beats: number[] = [];
  let time = -1 + random() * rr;
  let index = 0;
  while (time < SECONDS + 1) {
    beats.push(time);
    const variability =
      1 + 0.012 * Math.sin((2 * Math.PI * index) / 4.5) + 0.006 * (random() - 0.5);
    time += rr * variability;
    index += 1;
  }

  const qrsScale = preset.qrsScale ?? 1;
  const ptGain = preset.ptScale ?? 1;
  const alternans = preset.alternans ?? 0;

  function leadSignal(morph: LeadMorphology): Float64Array {
    const out = new Float64Array(count);
    for (let sample = 0; sample < count; sample += 1) {
      const t = sample / SAMPLE_HZ;
      let v = 0;
      for (let beat = 0; beat < beats.length; beat += 1) {
        const dt = t - (beats[beat] ?? 0);
        if (dt < -0.35 || dt > 0.75) continue;
        const swing = alternans ? (beat % 2 === 0 ? 1 + alternans : 1 - alternans) : 1;
        v += beatVoltage(morph, dt, timing, preset.qrsWidth, qrsScale * swing, ptGain);
      }
      out[sample] = v;
    }
    return out;
  }

  const lead1 = leadSignal(preset.I);
  const lead3 = leadSignal(preset.III);
  const derive = (fn: (i: number, iii: number) => number) => {
    const out = new Float64Array(count);
    for (let sample = 0; sample < count; sample += 1) {
      out[sample] = fn(lead1[sample] ?? 0, lead3[sample] ?? 0);
    }
    return out;
  };

  const samples: Record<EcgLead, Float64Array> = {
    I: lead1,
    III: lead3,
    II: derive((i, iii) => i + iii),
    aVR: derive((i, iii) => -(2 * i + iii) / 2),
    aVL: derive((i, iii) => (i - iii) / 2),
    aVF: derive((i, iii) => i / 2 + iii),
    V1: leadSignal(preset.precordial.V1),
    V2: leadSignal(preset.precordial.V2),
    V3: leadSignal(preset.precordial.V3),
    V4: leadSignal(preset.precordial.V4),
    V5: leadSignal(preset.precordial.V5),
    V6: leadSignal(preset.precordial.V6),
  };

  // Gentle baseline wander and a whisper of muscle noise, per lead.
  for (const signal of Object.values(samples)) {
    const phase = random() * Math.PI * 2;
    const wander = 0.02 + random() * 0.025;
    for (let sample = 0; sample < count; sample += 1) {
      const t = sample / SAMPLE_HZ;
      signal[sample] =
        (signal[sample] ?? 0) +
        wander * Math.sin(2 * Math.PI * 0.22 * t + phase) +
        (random() - 0.5) * 0.012;
    }
  }

  const qrsMs = Math.round(88 * preset.qrsWidth);
  const qtMs = Math.round(
    (0.026 * preset.qrsWidth + 0.012 + timing.tPeak + 2.4 * timing.tRight) * 1000,
  );
  return {
    samples,
    intervals: {
      prMs: 156,
      qrsMs,
      qtMs,
      qtcMs: Math.round(qtMs / Math.sqrt(rr)),
    },
  };
}

// ---------------------------------------------------------------------------
// SVG

function u(mm: number): string {
  return (Math.round(mm * UNIT * 10) / 10).toString();
}

function gridMarkup(): string {
  const minor: string[] = [];
  const major: string[] = [];
  for (let x = GRID.x0; x <= GRID.x1 + 0.01; x += 1) {
    ((x - GRID.x0) % 5 === 0 ? major : minor).push(`M${u(x)} ${u(GRID.y0)}V${u(GRID.y1)}`);
  }
  for (let y = GRID.y0; y <= GRID.y1 + 0.01; y += 1) {
    ((y - GRID.y0) % 5 === 0 ? major : minor).push(`M${u(GRID.x0)} ${u(y)}H${u(GRID.x1)}`);
  }
  return (
    `<path d="${minor.join("")}" stroke="#f4c9c9" stroke-width="0.9" fill="none"/>` +
    `<path d="${major.join("")}" stroke="#e59a9a" stroke-width="1.7" fill="none"/>`
  );
}

function tracePath(
  signal: Float64Array,
  fromS: number,
  toS: number,
  x0: number,
  baseline: number,
): string {
  const first = Math.round(fromS * SAMPLE_HZ);
  const last = Math.min(signal.length - 1, Math.round(toS * SAMPLE_HZ));
  const parts: string[] = [];
  for (let sample = first; sample <= last; sample += 1) {
    const x = x0 + ((sample - first) / SAMPLE_HZ) * MM_PER_S;
    const y = baseline - (signal[sample] ?? 0) * MM_PER_MV;
    parts.push(`${sample === first ? "M" : "L"}${u(x)} ${u(y)}`);
  }
  return parts.join("");
}

function calibrationPulse(baseline: number): string {
  const top = baseline - MM_PER_MV;
  return `M${u(5)} ${u(baseline)}H${u(6.5)}V${u(top)}H${u(11.5)}V${u(baseline)}H${u(TRACE_X0)}`;
}

function text(
  x: number,
  y: number,
  size: number,
  content: string,
  weight = 400,
  anchor = "start",
): string {
  return `<text x="${u(x)}" y="${u(y)}" font-size="${u(size)}" font-weight="${weight}" text-anchor="${anchor}">${content}</text>`;
}

/** Clamp to a physiological, renderable rate. */
function renderRate(tracing: EcgTracing): number {
  return Math.round(Math.min(220, Math.max(35, tracing.heartRate ?? 75)));
}

/** Render a full 12-lead ECG as a standalone SVG document (ASCII only). */
export function renderEcgSvg(tracing: EcgTracing): string {
  const preset = PRESETS[tracing.preset];
  const heartRate = renderRate(tracing);
  const { samples, intervals } = synthesise(
    preset,
    heartRate,
    hashString(`${tracing.preset}:${heartRate}`),
  );

  const traces: string[] = [];
  const labels: string[] = [];
  const ticks: string[] = [];
  LAYOUT.forEach((row, rowIndex) => {
    const baseline = ROW_BASELINES[rowIndex] ?? 0;
    traces.push(calibrationPulse(baseline));
    row.forEach((lead, col) => {
      const from = col * COLUMN_SECONDS;
      const x0 = TRACE_X0 + from * MM_PER_S;
      traces.push(tracePath(samples[lead], from, from + COLUMN_SECONDS, x0, baseline));
      labels.push(text(x0 + 2.5, baseline - 15, 3.4, lead, 700));
      if (col > 0) ticks.push(`M${u(x0)} ${u(baseline - 4)}V${u(baseline + 4)}`);
    });
  });
  const rhythmBaseline = ROW_BASELINES[3] ?? 0;
  traces.push(calibrationPulse(rhythmBaseline));
  traces.push(tracePath(samples.II, 0, SECONDS, TRACE_X0, rhythmBaseline));
  labels.push(text(TRACE_X0 + 2.5, rhythmBaseline - 15, 3.4, "II", 700));

  const header = [
    text(5, 6.5, 3.6, "12-lead ECG (simulated)", 700),
    text(5, 11, 2.9, "25 mm/s &#183; 10 mm/mV &#183; 0.05&#8211;150 Hz"),
    text(118, 6.5, 2.9, `Vent. rate ${heartRate} bpm`),
    text(118, 11, 2.9, `PR ${intervals.prMs} ms &#183; QRS ${intervals.qrsMs} ms`),
    text(178, 6.5, 2.9, `QT/QTc ${intervals.qtMs}/${intervals.qtcMs} ms`),
    text(178, 11, 2.9, "Unconfirmed &#8212; for teaching use"),
  ].join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W * UNIT} ${PAGE_H * UNIT}" ` +
    `width="${PAGE_W * UNIT}" height="${PAGE_H * UNIT}" font-family="Helvetica, Arial, sans-serif" fill="#1d2329">` +
    `<rect width="100%" height="100%" fill="#fffafa"/>` +
    gridMarkup() +
    `<g>${header}</g>` +
    `<path d="${ticks.join("")}" stroke="#1d2329" stroke-width="1.6" fill="none"/>` +
    `<path d="${traces.join("")}" stroke="#16191d" stroke-width="1.7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<g paint-order="stroke" stroke="#fffafa" stroke-width="5" stroke-linejoin="round">${labels.join("")}</g>` +
    text(PAGE_W - 5, PAGE_H - 2, 2.6, "Generated tracing for the case simulator", 400, "end") +
    `</svg>`
  );
}

const dataUrlCache = new Map<string, string>();

/** `data:` URL for an <img>; cached per preset and rate. */
export function ecgDataUrl(tracing: EcgTracing): string {
  const key = `${tracing.preset}:${renderRate(tracing)}`;
  let url = dataUrlCache.get(key);
  if (!url) {
    url = `data:image/svg+xml;base64,${btoa(renderEcgSvg(tracing))}`;
    dataUrlCache.set(key, url);
  }
  return url;
}

export function ecgAltText(tracing: EcgTracing): string {
  const heartRate = renderRate(tracing);
  const rhythm =
    heartRate >= 100 ? "Sinus tachycardia" : heartRate < 60 ? "Sinus bradycardia" : "Sinus rhythm";
  return `Simulated 12-lead ECG: ${rhythm.toLowerCase()} at ${heartRate} beats per minute with ${PRESETS[tracing.preset].summary}.`;
}

export const ECG_ATTRIBUTION =
  "Simulated 12-lead ECG generated for this case at the patient's heart rate when it was recorded (25 mm/s, 10 mm/mV).";
