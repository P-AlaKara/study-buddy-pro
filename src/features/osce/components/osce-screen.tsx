import { useEffect, useId, useRef, useState } from "react";
import {
  advanceIdleTime,
  advanceReadingCountdown,
  answerExaminerQuestion,
  createInitialOsceState,
  endConsultation,
  enterRoom,
  getRapportBand,
  markStudentActive,
  requestNudge,
  selectOsceCard,
  skipReading,
  type OsceState,
} from "../engine.js";
import type { OsceCard, OsceCategory, OsceMode, OsceStation } from "../schema.js";
import { ConsultationRoom } from "./consultation-room.js";
import { DoorScreen } from "./door-screen.js";
import { ExaminerQuestions } from "./examiner-questions.js";
import { StationComplete } from "./station-complete.js";

function seedFromText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function OsceScreen({ station, mode }: { station: OsceStation; mode: OsceMode }) {
  const reactSessionId = useId();
  const initialSeed = seedFromText(`${station.id}:${mode}:${reactSessionId}`);
  const [seed, setSeed] = useState(initialSeed);
  const [game, setGame] = useState<OsceState>(() =>
    createInitialOsceState(station, mode, initialSeed),
  );
  const [category, setCategory] = useState<OsceCategory>("opening");
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (game.phase !== "door" || game.readingSecondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setGame((current) =>
        current.phase === "door" ? advanceReadingCountdown(current, station, 1) : current,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [game.phase, game.readingSecondsRemaining, station]);

  useEffect(() => {
    if (game.phase !== "room" || pendingCardId) return;
    const timer = setInterval(() => {
      setGame((current) =>
        current.phase === "room" ? advanceIdleTime(current, station, 1) : current,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [game.phase, pendingCardId, station]);

  useEffect(() => {
    if (game.curveball.status === "pending") setCategory("communicate");
  }, [game.curveball.status]);

  function chooseCard(card: OsceCard) {
    if (pendingCardId) return;
    setPendingCardId(card.id);
    const reply = card.replies[getRapportBand(game.rapport)];
    const delay = Math.round(Math.min(1500, Math.max(800, 720 + reply.length * 7)));
    replyTimerRef.current = setTimeout(() => {
      setGame((current) =>
        current.phase === "room" ? selectOsceCard(current, station, card.id) : current,
      );
      setPendingCardId(null);
      replyTimerRef.current = null;
    }, delay);
  }

  function noteActivity() {
    setGame((current) =>
      current.phase === "room" ? markStudentActive(current, station) : current,
    );
  }

  function retry() {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    const nextSeed = (seed + 1) >>> 0;
    setSeed(nextSeed);
    setGame(createInitialOsceState(station, mode, nextSeed));
    setCategory("opening");
    setPendingCardId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (game.phase === "door") {
    return (
      <DoorScreen
        station={station}
        mode={mode}
        readingSecondsRemaining={game.readingSecondsRemaining}
        onSkipReading={() => setGame((current) => skipReading(current, station))}
        onEnter={() => setGame((current) => enterRoom(current, station))}
      />
    );
  }

  if (game.phase === "room") {
    return (
      <ConsultationRoom
        game={game}
        station={station}
        mode={mode}
        category={category}
        pendingCardId={pendingCardId}
        onCategoryChange={setCategory}
        onChoose={chooseCard}
        onEnd={() => setGame((current) => endConsultation(current, station))}
        onNudge={() => setGame((current) => requestNudge(current, station))}
        onActivity={noteActivity}
      />
    );
  }

  if (game.phase === "examiner_questions") {
    return (
      <ExaminerQuestions
        game={game}
        station={station}
        onAnswer={(questionId, selectedIds) =>
          setGame((current) => answerExaminerQuestion(current, station, questionId, selectedIds))
        }
      />
    );
  }

  return <StationComplete game={game} station={station} onRetry={retry} />;
}
