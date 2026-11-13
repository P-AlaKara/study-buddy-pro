import { type ComponentType } from "react";
import { Activity, Droplet, HeartPulse, Thermometer, Wind } from "lucide-react";
import { formatBloodPressure, type GameState } from "../engine.js";

type VitalState = "normal" | "warning" | "critical";

interface VitalDescriptor {
  key: string;
  label: string;
  /** Monitor-style abbreviation shown on the strip; `label` stays for screen readers. */
  short: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  /** Monitor accent (golden / violet / mint) for the icon + sparkline when healthy. */
  accent: string;
  state: VitalState;
  /** 0–1 waviness used to vary the sparkline shape per vital. */
  seed: number;
}

function buildVitals(game: GameState): VitalDescriptor[] {
  const { hr, rr, spo2, temp, systolicBp } = game.vitals;
  const hrState: VitalState = hr >= 130 || hr < 45 ? "critical" : hr > 110 ? "warning" : "normal";
  const bpState: VitalState =
    systolicBp < 90 ? "critical" : systolicBp < 100 || systolicBp > 180 ? "warning" : "normal";
  const rrState: VitalState = rr >= 30 || rr < 8 ? "critical" : rr >= 24 ? "warning" : "normal";
  const spo2State: VitalState = spo2 < 90 ? "critical" : spo2 < 94 ? "warning" : "normal";
  const tempState: VitalState =
    temp >= 39.5 || temp < 35 ? "critical" : temp >= 38 ? "warning" : "normal";
  return [
    {
      key: "hr",
      label: "Heart rate",
      short: "HR",
      value: String(hr),
      unit: "bpm",
      icon: HeartPulse,
      accent: "#ffc928",
      state: hrState,
      seed: 0.95,
    },
    {
      key: "bp",
      label: "Blood pressure",
      short: "BP",
      value: formatBloodPressure(game.vitals),
      unit: "mmHg",
      icon: Activity,
      accent: "#ffc928",
      state: bpState,
      seed: 0.45,
    },
    {
      key: "rr",
      label: "Respiratory rate",
      short: "RR",
      value: String(rr),
      unit: "/min",
      icon: Wind,
      accent: "#ffc928",
      state: rrState,
      seed: 0.7,
    },
    {
      key: "spo2",
      label: "Oxygen saturation",
      short: "SpO₂",
      value: `${spo2}`,
      unit: "%",
      icon: Droplet,
      accent: "#c86bfa",
      state: spo2State,
      seed: 0.3,
    },
    {
      key: "temp",
      label: "Temperature",
      short: "Temp",
      value: temp.toFixed(1),
      unit: "°C",
      icon: Thermometer,
      accent: "#3de3c0",
      state: tempState,
      seed: 0.18,
    },
  ];
}

/** A gentle wandering sparkline, shaped by the vital's seed. */
function Sparkline({ color, seed }: { color: string; seed: number }) {
  const width = 112;
  const height = 22;
  const mid = height / 2;
  const points = 24;
  const path = Array.from({ length: points + 1 }, (_, index) => {
    const x = (index / points) * width;
    const wave =
      Math.sin(index * (0.7 + seed) + seed * 6) * (3 + seed * 3) +
      Math.sin(index * (0.33 + seed * 0.5)) * 2.2;
    const y = Math.max(2, Math.min(height - 2, mid - wave));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      className="case-vital-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Monitor-style vitals: a slim, dark bedside-monitor strip of the five
 * essential readouts (HR, BP, RR, SpO₂, temperature), each with its
 * waveform. It runs across the top of the encounter under the top bar; on
 * phones the waveforms and units drop away and only the readouts remain.
 */
export function VitalsMonitor({ game, className = "" }: { game: GameState; className?: string }) {
  const vitals = buildVitals(game);
  return (
    <div className={`case-vitals-strip ${className}`} role="group" aria-label="Patient vital signs">
      {vitals.map((vital) => {
        const Icon = vital.icon;
        // Monitor palette on the dark strip: golden for warnings, a lighter
        // red than the app's critical token so it stays legible on smoke.
        const lineColor =
          vital.state === "critical"
            ? "#ff6161"
            : vital.state === "warning"
              ? "#ffc928"
              : vital.accent;
        return (
          <div key={vital.key} data-state={vital.state} className="case-vital">
            <div className="case-vital-readout">
              <p className="case-vital-label">
                <span style={{ color: lineColor }}>
                  <Icon className="size-3.5" />
                </span>
                <span aria-hidden="true">{vital.short}</span>
                <span className="sr-only">{vital.label}</span>
              </p>
              <p
                className="case-vital-value font-mono font-black leading-none"
                style={{ color: vital.state === "normal" ? "#faf9ff" : lineColor }}
              >
                {vital.value}
                <span className="case-vital-unit">{vital.unit}</span>
              </p>
            </div>
            <Sparkline color={lineColor} seed={vital.seed} />
          </div>
        );
      })}
    </div>
  );
}
