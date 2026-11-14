/**
 * Waveform shapes for the bedside-monitor vitals. Pure maths, no DOM.
 *
 * Every shape returns a normalised deflection (roughly 0 = baseline, 1 = peak)
 * for a moment within one cycle. The cycle length always comes from the live
 * case vitals (HR for the ECG and pleth, RR for respiration), so the traces
 * speed up or slow down only when the engine's readings do — nothing here
 * invents variability.
 */

function gaussian(t: number, centre: number, width: number): number {
  const d = (t - centre) / width;
  return Math.exp(-0.5 * d * d);
}

/** Asymmetric bump: a quicker rise than fall, like an arterial upstroke. */
function skewedBump(t: number, centre: number, rise: number, fall: number): number {
  return gaussian(t, centre, t < centre ? rise : fall);
}

/**
 * Lead-II style ECG complex for `t` seconds after the beat starts, with a
 * beat length of `beat` seconds. P, QRS and T are positioned in absolute time
 * (a QRS is ~90 ms wide whatever the rate) and the QT interval shortens with
 * rate (Bazett), so a tachycardic trace looks tachycardic rather than a
 * squashed copy of a slow one.
 */
function ecgComplex(t: number, beat: number): number {
  const qt = 0.25 * Math.sqrt(Math.min(beat, 1.5));
  return (
    0.12 * gaussian(t, 0.07, 0.022) - // P
    0.1 * gaussian(t, 0.155, 0.007) + // Q
    1.0 * gaussian(t, 0.172, 0.009) - // R
    0.24 * gaussian(t, 0.19, 0.008) + // S
    0.28 * gaussian(t, 0.17 + qt, 0.042) // T
  );
}

export function ecgSample(t: number, beat: number): number {
  // Include the tail of the previous complex so a fast rate never clips its T wave.
  return ecgComplex(t, beat) + ecgComplex(t + beat, beat);
}

/**
 * Pulse-oximetry plethysmograph: a rounded systolic peak and a softer
 * dicrotic shoulder. It follows the same beat as the ECG, delayed by the
 * pulse-transit time from heart to fingertip.
 */
const PULSE_TRANSIT_SECONDS = 0.16;

export function plethSample(t: number, beat: number): number {
  const delayed = (((t - PULSE_TRANSIT_SECONDS) % beat) + beat) % beat;
  const phase = delayed / beat;
  const wave = (p: number) => skewedBump(p, 0.24, 0.1, 0.22) + 0.26 * gaussian(p, 0.6, 0.1);
  // The previous pulse's run-off carries over into the start of the next.
  return 0.08 + 0.92 * (wave(phase) + wave(phase + 1));
}

/**
 * Respiration (impedance) trace: an active, rounded inspiration taking about
 * 40% of the breath, a passive expiration, then a short end-expiratory pause.
 */
export function respirationSample(t: number, breath: number): number {
  const phase = (((t % breath) + breath) % breath) / breath;
  if (phase < 0.4) return 0.5 - 0.5 * Math.cos((Math.PI * phase) / 0.4);
  if (phase < 0.88) return 0.5 + 0.5 * Math.cos((Math.PI * (phase - 0.4)) / 0.48);
  return 0;
}

/**
 * A smooth trend through recorded readings, sampled at `x` (0..1 across the
 * trace). Readings are spaced evenly with cosine easing between them; one
 * reading draws a flat line. Returned as 0..1 within `minSpan` so a tiny
 * change is not blown up to full height.
 */
export function trendSample(readings: readonly number[], x: number, minSpan: number): number {
  if (readings.length === 0) return 0.5;
  const low = Math.min(...readings);
  const high = Math.max(...readings);
  const span = Math.max(high - low, minSpan);
  const floor = (low + high) / 2 - span / 2;
  const norm = (value: number) => (value - floor) / span;
  if (readings.length === 1) return norm(readings[0]!);
  const position = Math.min(Math.max(x, 0), 1) * (readings.length - 1);
  const index = Math.min(Math.floor(position), readings.length - 2);
  const local = position - index;
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * local);
  return norm(readings[index]! + (readings[index + 1]! - readings[index]!) * eased);
}
