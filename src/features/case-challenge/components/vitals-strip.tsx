import { type ComponentType } from "react";
import { Activity, Clock3, Gauge, HeartPulse, Thermometer, Wind } from "lucide-react";
import { formatBloodPressure, formatCaseClock, type GameState } from "../engine.js";

type VitalState = "normal" | "warning" | "critical";

const stateText: Record<VitalState, string> = {
  normal: "text-slate-900",
  warning: "text-[var(--case-yellow-ink)]",
  critical: "text-[var(--case-critical)]",
};

function worst(...states: VitalState[]): VitalState {
  if (states.includes("critical")) return "critical";
  if (states.includes("warning")) return "warning";
  return "normal";
}

interface VitalDescriptor {
  key: string;
  label: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  state: VitalState;
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
      state: hrState,
    },
    {
      key: "bp",
      label: "Blood pressure",
      value: formatBloodPressure(game.vitals),
      unit: "mmHg",
      icon: Activity,
      state: bpState,
    },
    { key: "rr", label: "Resp. rate", value: String(rr), unit: "/min", icon: Wind, state: rrState },
    { key: "spo2", label: "SpO₂", value: `${spo2}`, unit: "%", icon: Gauge, state: spo2State },
    {
      key: "temp",
      label: "Temperature",
      value: temp.toFixed(1),
      unit: "°C",
      icon: Thermometer,
      state: tempState,
    },
  ];
}

export function VitalsStrip({ game }: { game: GameState }) {
  const vitals = buildVitals(game);
  const overall = worst(...vitals.map((vital) => vital.state));

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      role="group"
      aria-label="Patient vital signs"
    >
      {vitals.map((vital) => {
        const Icon = vital.icon;
        return (
          <div
            key={vital.key}
            data-state={vital.state}
            className="case-vital-card flex items-center gap-2.5 px-3 py-2.5"
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-xl bg-slate-50 ${
                vital.state === "critical"
                  ? "text-[var(--case-critical)]"
                  : vital.state === "warning"
                    ? "text-[var(--case-yellow-ink)]"
                    : "text-slate-500"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-black uppercase tracking-wider text-slate-400">
                {vital.label}
              </p>
              <p className={`font-mono text-lg font-black leading-none ${stateText[vital.state]}`}>
                {vital.value}
                <span className="ml-0.5 text-[10px] font-bold text-slate-400">{vital.unit}</span>
              </p>
            </div>
          </div>
        );
      })}
      <div
        data-state={overall === "critical" ? "critical" : "normal"}
        className="case-vital-card flex items-center gap-2.5 px-3 py-2.5"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
          <Clock3 className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[9px] font-black uppercase tracking-wider text-slate-400">
            Case clock
          </p>
          <p className="font-mono text-lg font-black leading-none text-slate-900">
            {formatCaseClock(game.timeMinute)}
          </p>
        </div>
      </div>
    </div>
  );
}
