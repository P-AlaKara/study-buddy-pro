import { type ComponentType, type CSSProperties } from "react";
import { Activity, ArrowDown, ArrowUp, Droplet, HeartPulse, Thermometer, Wind } from "lucide-react";
import { formatBloodPressure, type GameState, type RuntimeVitals } from "../engine.js";
import type { VitalKey, VitalsFeed } from "./use-vitals-feed.js";
import { VitalTrace, type TraceKind } from "./vital-trace.js";

/* Monitor palette (on the smoky #49445F tiles). */
const AMBER = "#ffc928";
const LAVENDER = "#c68bfa";
const CYAN = "#53d9f0";
const GREEN = "#4ade80";
const TEAL = "#2dd4bf";
const CORAL = "#ff7185";
const WHITE = "#f7f5ff";

type VitalState = "normal" | "warning" | "critical";

interface TileTrace {
  kind: TraceKind;
  rate?: number;
  readings?: readonly number[];
  minSpan?: number;
  sweepSeconds: number;
}

interface VitalTile {
  key: VitalKey;
  label: string;
  /** Monitor abbreviation shown on the tile; `label` is for screen readers. */
  short: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  /** Trace + icon colour; constant per vital so each stays recognisable. */
  accent: string;
  /** Colour of the number itself (coral once the reading is dangerous). */
  valueColor: string;
  state: VitalState;
  trace: TileTrace;
  wide?: boolean;
}

function buildTiles(vitals: RuntimeVitals, feed: VitalsFeed): VitalTile[] {
  const { hr, rr, spo2, temp, systolicBp } = vitals;
  const hrState: VitalState = hr >= 130 || hr < 45 ? "critical" : hr > 110 ? "warning" : "normal";
  const bpState: VitalState =
    systolicBp < 90 ? "critical" : systolicBp < 100 || systolicBp > 180 ? "warning" : "normal";
  const rrState: VitalState = rr >= 30 || rr < 8 ? "critical" : rr >= 24 ? "warning" : "normal";
  const spo2State: VitalState = spo2 < 90 ? "critical" : spo2 < 94 ? "warning" : "normal";
  const tempState: VitalState =
    temp >= 39.5 || temp < 35 ? "critical" : temp >= 38 ? "warning" : "normal";
  const coralIfCritical = (state: VitalState, color: string) =>
    state === "critical" ? CORAL : color;

  return [
    {
      key: "hr",
      label: "Heart rate",
      short: "HR",
      value: String(hr),
      unit: "bpm",
      icon: HeartPulse,
      accent: AMBER,
      valueColor: coralIfCritical(hrState, AMBER),
      state: hrState,
      trace: { kind: "ecg", rate: hr, sweepSeconds: 2 },
    },
    {
      key: "bp",
      label: "Blood pressure",
      short: "BP",
      value: formatBloodPressure(vitals),
      unit: "mmHg",
      icon: Activity,
      accent: LAVENDER,
      valueColor: coralIfCritical(bpState, WHITE),
      state: bpState,
      // Non-invasive BP is intermittent: a slow trend, not an arterial line.
      trace: { kind: "trend", readings: feed.systolicTrend, minSpan: 24, sweepSeconds: 9 },
    },
    {
      key: "rr",
      label: "Respiratory rate",
      short: "RR",
      value: String(rr),
      unit: "/min",
      icon: Wind,
      accent: CYAN,
      valueColor: coralIfCritical(rrState, CYAN),
      state: rrState,
      trace: { kind: "resp", rate: rr, sweepSeconds: 9 },
    },
    {
      key: "spo2",
      label: "Oxygen saturation",
      short: "SpO₂",
      value: String(spo2),
      unit: "%",
      icon: Droplet,
      accent: GREEN,
      // Any desaturation below 94% turns the number coral.
      valueColor: spo2State === "normal" ? GREEN : CORAL,
      state: spo2State,
      // Same rate as the ECG; a slightly slower sweep keeps the pulses rounded.
      trace: { kind: "pleth", rate: hr, sweepSeconds: 2.6 },
    },
    {
      key: "temp",
      label: "Temperature",
      short: "Temp",
      value: temp.toFixed(1),
      unit: "°C",
      icon: Thermometer,
      accent: TEAL,
      valueColor: coralIfCritical(tempState, WHITE),
      state: tempState,
      trace: { kind: "trend", readings: feed.tempTrend, minSpan: 1.2, sweepSeconds: 0 },
      wide: true,
    },
  ];
}

/**
 * Bedside-monitor vitals for the case panel: HR / BP / RR / SpO₂ in a 2 × 2
 * grid with temperature full-width beneath. Each tile carries a live trace
 * (ECG, BP trend, respiration, pleth, temperature trend) driven by the
 * engine's readings; a reading that changes glows briefly, and a dangerous
 * one turns coral with a steady outline rather than flashing the screen.
 */
export function VitalsMonitor({
  game,
  feed,
  announce = false,
  className = "",
}: {
  game: GameState;
  feed: VitalsFeed;
  /** Give this instance the polite live region (one per visible layout). */
  announce?: boolean;
  className?: string;
}) {
  const tiles = buildTiles(game.vitals, feed);
  return (
    <div className={`case-vitals-grid ${className}`} role="group" aria-label="Patient vital signs">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const change = feed.changes[tile.key];
        const alertColor = tile.state === "critical" ? CORAL : tile.valueColor;
        return (
          <div
            key={tile.key}
            className="case-vital"
            data-vital={tile.key}
            data-state={tile.state}
            data-wide={tile.wide ? "" : undefined}
            data-flash={change}
            style={
              {
                "--vital-accent": tile.accent,
                "--vital-alert": alertColor,
              } as CSSProperties
            }
          >
            <p className="case-vital-label">
              <span style={{ color: tile.accent }}>
                <Icon className="size-3.5" />
              </span>
              <span aria-hidden="true">{tile.short}</span>
              <span className="sr-only">{tile.label}</span>
              {change && (
                <span className="case-vital-delta" style={{ color: tile.valueColor }}>
                  {change === "up" ? (
                    <ArrowUp className="size-3" aria-label="rising" />
                  ) : (
                    <ArrowDown className="size-3" aria-label="falling" />
                  )}
                </span>
              )}
              {tile.state === "critical" && (
                <span className="case-vital-alarm" role="img" aria-label="critical" />
              )}
            </p>
            <p className="case-vital-value" style={{ color: tile.valueColor }}>
              {tile.value}
              <span className="case-vital-unit">{tile.unit}</span>
            </p>
            <VitalTrace
              className="case-vital-trace"
              color={tile.accent}
              kind={tile.trace.kind}
              rate={tile.trace.rate}
              readings={tile.trace.readings}
              minSpan={tile.trace.minSpan}
              sweepSeconds={tile.trace.sweepSeconds}
            />
          </div>
        );
      })}
      {announce && (
        <p className="sr-only" aria-live="polite">
          {feed.announcement}
        </p>
      )}
    </div>
  );
}
