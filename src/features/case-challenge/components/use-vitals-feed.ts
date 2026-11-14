import { useEffect, useRef, useState } from "react";
import type { GameState, RuntimeVitals } from "../engine.js";

export type VitalKey = "hr" | "bp" | "rr" | "spo2" | "temp";
export type VitalChange = "up" | "down";

/** How long a changed reading stays highlighted (matches the CSS animation). */
const FLASH_MS = 1800;
/** Changes this soon after mount are a saved encounter being restored, not the patient changing. */
const SETTLE_MS = 800;
/** Readings kept for the BP and temperature trend lines. */
const TREND_POINTS = 6;

export interface VitalsFeed {
  /** Systolic readings recorded during this encounter, oldest first. */
  systolicTrend: number[];
  /** Temperature readings recorded during this encounter, oldest first. */
  tempTrend: number[];
  /** Vitals that changed in the last moment, and which way. */
  changes: Partial<Record<VitalKey, VitalChange>>;
  /** Screen-reader summary of the most recent change. */
  announcement: string;
}

function seedTrend(arrival: number, current: number): number[] {
  return arrival === current ? [current] : [arrival, current];
}

const directionWord = (change: VitalChange) => (change === "up" ? "rose" : "fell");

/**
 * Tracks how the engine's vitals move during the encounter: short trend
 * histories for BP and temperature, and a brief "just changed" flag per vital
 * for the highlight. Only real engine changes are recorded; a restored save
 * or a retry resets the history (seeded with the arrival readings, which the
 * patient genuinely had) without flashing anything.
 */
export function useVitalsFeed(game: GameState, arrival: RuntimeVitals): VitalsFeed {
  const { hr, systolicBp, diastolicBp, rr, spo2, temp } = game.vitals;
  const [trends, setTrends] = useState(() => ({
    systolic: seedTrend(arrival.systolicBp, systolicBp),
    temp: seedTrend(arrival.temp, temp),
  }));
  const [changes, setChanges] = useState<VitalsFeed["changes"]>({});
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef({ ...game.vitals, sequence: game.sequence, caseId: game.caseId });
  const mountedAt = useRef(0);
  const timers = useRef(new Map<VitalKey, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    mountedAt.current = performance.now();
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    const prev = previous.current;
    previous.current = {
      hr,
      systolicBp,
      diastolicBp,
      rr,
      spo2,
      temp,
      sequence: game.sequence,
      caseId: game.caseId,
    };

    const diff: Partial<Record<VitalKey, VitalChange>> = {};
    const compare = (key: VitalKey, before: number, after: number) => {
      if (after !== before) diff[key] = after > before ? "up" : "down";
    };
    compare("hr", prev.hr, hr);
    compare(
      "bp",
      prev.systolicBp === systolicBp ? prev.diastolicBp : prev.systolicBp,
      prev.systolicBp === systolicBp ? diastolicBp : systolicBp,
    );
    compare("rr", prev.rr, rr);
    compare("spo2", prev.spo2, spo2);
    compare("temp", prev.temp, temp);
    if (Object.keys(diff).length === 0 && prev.caseId === game.caseId) return;

    const restarted =
      prev.caseId !== game.caseId ||
      game.sequence < prev.sequence ||
      performance.now() - mountedAt.current < SETTLE_MS;
    if (restarted) {
      setTrends({
        systolic: seedTrend(arrival.systolicBp, systolicBp),
        temp: seedTrend(arrival.temp, temp),
      });
      setChanges({});
      return;
    }

    setTrends((current) => ({
      systolic: diff.bp ? [...current.systolic, systolicBp].slice(-TREND_POINTS) : current.systolic,
      temp: diff.temp ? [...current.temp, temp].slice(-TREND_POINTS) : current.temp,
    }));
    setChanges((current) => ({ ...current, ...diff }));
    for (const key of Object.keys(diff) as VitalKey[]) {
      clearTimeout(timers.current.get(key));
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          setChanges(({ [key]: _done, ...rest }) => rest);
        }, FLASH_MS),
      );
    }
    const readout: Record<VitalKey, [string, string]> = {
      hr: ["Heart rate", `${hr} beats per minute`],
      bp: ["Blood pressure", `${systolicBp} over ${diastolicBp}`],
      rr: ["Respiratory rate", `${rr} per minute`],
      spo2: ["Oxygen saturation", `${spo2} percent`],
      temp: ["Temperature", `${temp.toFixed(1)} degrees`],
    };
    setAnnouncement(
      (Object.entries(diff) as Array<[VitalKey, VitalChange]>)
        .map(([key, change]) => `${readout[key][0]} ${directionWord(change)} to ${readout[key][1]}`)
        .join(". "),
    );
    // `arrival` is fixed for a case; the case id covers it changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hr, systolicBp, diastolicBp, rr, spo2, temp, game.sequence, game.caseId]);

  return {
    systolicTrend: trends.systolic,
    tempTrend: trends.temp,
    changes,
    announcement,
  };
}
