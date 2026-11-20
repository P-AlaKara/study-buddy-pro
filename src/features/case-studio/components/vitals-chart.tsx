import { useState, type PointerEvent } from "react";
import type { RuntimeVitals } from "@/features/case-challenge/engine";
import type { VitalSign } from "@/features/case-challenge/schema";
import { formatVital } from "../case-analysis";
import { VITAL_META } from "../vocabulary";
import { Disclosure } from "./studio-ui";

/*
 * Small multiples of the patient's vitals over case time (one chart per sign,
 * each on its own axis — never a dual axis). Vitals in the simulator change in
 * steps at events, so lines are drawn as steps. Hovering any chart shows the
 * same minute on all four; a table view carries the same numbers.
 */

export interface ChartPoint {
  minute: number;
  vitals: RuntimeVitals;
}

export interface ChartMarker {
  minute: number;
  label: string;
  kind: "event" | "lost";
}

const SIGNS: readonly VitalSign[] = ["hr", "systolicBp", "rr", "spo2"];
const SERIES = "#5a44b5";
const W = 300;
const H = 124;
const PAD = { left: 36, right: 12, top: 16, bottom: 26 };

function niceRange(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 6);
  const pad = span * 0.18;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function valueAt(points: readonly ChartPoint[], minute: number): ChartPoint | undefined {
  let current: ChartPoint | undefined;
  for (const point of points) if (point.minute <= minute) current = point;
  return current;
}

function MiniChart({
  sign,
  points,
  markers,
  endMinute,
  hover,
  onHover,
}: {
  sign: VitalSign;
  points: readonly ChartPoint[];
  markers: readonly ChartMarker[];
  endMinute: number;
  hover: number | null;
  onHover: (minute: number | null) => void;
}) {
  const meta = VITAL_META[sign];
  const values = points.map((point) => point.vitals[sign]);
  const [lo, hi] = niceRange(values);
  const x = (minute: number) =>
    PAD.left + (minute / Math.max(endMinute, 1)) * (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - (value - lo) / Math.max(hi - lo, 1)) * (H - PAD.top - PAD.bottom);

  let path = "";
  points.forEach((point, index) => {
    const px = x(point.minute);
    const py = y(point.vitals[sign]);
    if (index === 0) path += `M${px},${py}`;
    else path += `H${px}V${py}`;
  });
  const last = points.at(-1);
  if (last) path += `H${x(endMinute)}`;

  const hovered = hover === null ? undefined : valueAt(points, hover);
  const first = points[0]?.vitals[sign];
  const final = last?.vitals[sign];

  function move(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - box.left) / box.width) * W;
    const minute = ((ratio - PAD.left) / (W - PAD.left - PAD.right)) * endMinute;
    onHover(Math.max(0, Math.min(endMinute, Math.round(minute))));
  }

  const ticks = [...new Set([0, ...markers.map((marker) => marker.minute), endMinute])].sort(
    (a, b) => a - b,
  );

  return (
    <figure className="min-w-0 rounded-2xl bg-card p-3 ring-1 ring-border">
      <figcaption className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-[13px] font-extrabold">{meta.label}</span>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {first !== undefined && final !== undefined
            ? `${formatVital(sign, first)} → ${formatVital(sign, final)} ${meta.unit}`
            : ""}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block w-full touch-none"
        role="img"
        aria-label={`${meta.label} from ${first ?? "?"} to ${final ?? "?"} ${meta.unit} over ${endMinute} minutes`}
        onPointerMove={move}
        onPointerLeave={() => onHover(null)}
      >
        {/* recessive grid: top and bottom of the range only */}
        {[lo, hi].map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="#ece8f3" />
            <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#6b6880">
              {value}
            </text>
          </g>
        ))}
        {markers.map((marker) => (
          <line
            key={`${marker.kind}-${marker.minute}-${marker.label}`}
            x1={x(marker.minute)}
            x2={x(marker.minute)}
            y1={PAD.top - 6}
            y2={H - PAD.bottom}
            stroke={marker.kind === "lost" ? "#b42323" : "#a49bbd"}
            strokeDasharray={marker.kind === "lost" ? undefined : "3 3"}
            strokeWidth={marker.kind === "lost" ? 2 : 1}
          />
        ))}
        {markers
          .filter((marker) => marker.kind === "lost")
          .slice(0, 1)
          .map((marker) => (
            <text
              key="lost-label"
              x={x(marker.minute) - 4}
              y={PAD.top - 2}
              textAnchor="end"
              fontSize="10"
              fontWeight="800"
              fill="#8f2424"
            >
              Lost
            </text>
          ))}
        {ticks.map((minute) => (
          <text
            key={minute}
            x={x(minute)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#6b6880"
          >
            {minute}m
          </text>
        ))}
        <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={x(point.minute)}
            cy={y(point.vitals[sign])}
            r="4"
            fill={SERIES}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
        {hover !== null && hovered && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top - 6}
              y2={H - PAD.bottom}
              stroke="#2b2540"
              strokeWidth="1"
            />
            <rect
              x={Math.min(Math.max(x(hover) - 34, 2), W - 70)}
              y={0}
              width="68"
              height="15"
              rx="7"
              fill="#2b2540"
            />
            <text
              x={Math.min(Math.max(x(hover), 36), W - 36)}
              y={11}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#fff"
            >
              {hover}m · {formatVital(sign, hovered.vitals[sign])}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

export function VitalsSmallMultiples({
  points,
  markers,
  endMinute,
  caption,
}: {
  points: readonly ChartPoint[];
  markers: readonly ChartMarker[];
  endMinute: number;
  caption?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;
  const end = Math.max(endMinute, points.at(-1)?.minute ?? 0, 1);
  return (
    <div className="space-y-3">
      {caption && <p className="text-[13px] text-muted-foreground">{caption}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SIGNS.map((sign) => (
          <MiniChart
            key={sign}
            sign={sign}
            points={points}
            markers={markers}
            endMinute={end}
            hover={hover}
            onHover={setHover}
          />
        ))}
      </div>
      <Disclosure title="Show as a table" summary="The same observations, minute by minute">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[12px] font-extrabold uppercase tracking-wider text-ink-soft">
              <tr>
                <th scope="col" className="py-1.5 pr-3">
                  Minute
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  HR
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  BP
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  RR
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  SpO₂
                </th>
                <th scope="col" className="py-1.5 pr-3">
                  Temp
                </th>
                <th scope="col" className="py-1.5">
                  What happened
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {points.map((point, index) => (
                <tr key={index}>
                  <th scope="row" className="py-1.5 pr-3 font-bold">
                    {point.minute}
                  </th>
                  <td className="py-1.5 pr-3">{point.vitals.hr}</td>
                  <td className="py-1.5 pr-3">
                    {point.vitals.systolicBp}/{point.vitals.diastolicBp}
                  </td>
                  <td className="py-1.5 pr-3">{point.vitals.rr}</td>
                  <td className="py-1.5 pr-3">{point.vitals.spo2}%</td>
                  <td className="py-1.5 pr-3">{point.vitals.temp.toFixed(1)}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {markers
                      .filter((marker) => marker.minute === point.minute)
                      .map((marker) => marker.label)
                      .join("; ") || (point.minute === 0 ? "Arrival" : "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </div>
  );
}
