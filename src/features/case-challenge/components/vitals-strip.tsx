import { type ComponentType } from "react";
import { Activity, Droplet, HeartPulse, Thermometer, Wind } from "lucide-react";
import { formatBloodPressure, type GameState } from "../engine.js";

type VitalState = "normal" | "warning" | "critical";

interface VitalDescriptor {
  key: string;
  label: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  /** Brand accent (CSS variable) used for the icon + sparkline when healthy. */
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
      value: String(hr),
      unit: "bpm",
      icon: HeartPulse,
      accent: "var(--case-pink)",
      state: hrState,
      seed: 0.95,
    },
    {
      key: "bp",
      label: "Blood pressure",
      value: formatBloodPressure(game.vitals),
      unit: "mmHg",
      icon: Activity,
      accent: "var(--case-blue)",
      state: bpState,
      seed: 0.45,
    },
    {
      key: "rr",
      label: "Resp. rate",
      value: String(rr),
      unit: "/min",
      icon: Wind,
      accent: "var(--case-orange)",
      state: rrState,
      seed: 0.7,
    },
    {
      key: "spo2",
      label: "SpO₂",
      value: `${spo2}`,
      unit: "%",
      icon: Droplet,
      accent: "var(--case-accent)",
      state: spo2State,
      seed: 0.3,
    },
    {
      key: "temp",
      label: "Temperature",
      value: temp.toFixed(1),
      unit: "°C",
      icon: Thermometer,
      accent: "var(--case-mint)",
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

export function VitalsStrip({ game }: { game: GameState }) {
  const vitals = buildVitals(game);

  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      role="group"
      aria-label="Patient vital signs"
    >
      {vitals.map((vital) => {
        const Icon = vital.icon;
        // Healthy vitals read in their calm brand colour; abnormal ones draw the
        // eye in-brand (warning) or in clinical red (critical).
        const lineColor = vital.state === "critical" ? "var(--case-critical)" : vital.accent;
        const valueColor =
          vital.state === "critical"
            ? "text-[var(--case-critical)]"
            : vital.state === "warning"
              ? ""
              : "text-slate-900";
        return (
          <div
            key={vital.key}
            data-state={vital.state}
            className="case-vital-card flex flex-col px-3.5 py-3"
          >
            <div className="flex items-center gap-2">
              <span style={{ color: lineColor }}>
                <Icon className="size-4" />
              </span>
              <p className="truncate text-[9px] font-black uppercase tracking-wider text-slate-400">
                {vital.label}
              </p>
            </div>
            <p
              className={`mt-1.5 font-mono text-xl font-black leading-none ${valueColor}`}
              style={vital.state === "warning" ? { color: vital.accent } : undefined}
            >
              {vital.value}
              <span className="ml-1 text-[10px] font-bold text-slate-400">{vital.unit}</span>
            </p>
            <Sparkline color={lineColor} seed={vital.seed} />
          </div>
        );
      })}
    </div>
  );
}
