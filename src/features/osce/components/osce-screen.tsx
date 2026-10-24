import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logProblem } from "@/lib/log-problem";
import type { AmbroseExpression } from "@/features/case-challenge/components/dr-ambrose";
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
  type OscePhase,
  type OsceState,
} from "../engine.js";
import { saveOsceResult } from "../progress.js";
import {
  answerOsceAiExaminerQuestion,
  createOsceAiSession,
  endOsceAiConsultation,
  generateOsceAiFeedback,
  recordOsceGuidedAction,
  resumeOsceAiSession,
  requestOsceAiNudge,
  submitOsceFreeFormInteraction,
  type OsceAiNarrative,
} from "../osce-ai.functions.js";
import type {
  OsceCard,
  OsceCategory,
  OsceInteractionMode,
  OsceMode,
  OsceStation,
} from "../schema.js";
import { ConsultationRoom } from "./consultation-room.js";
import { DoorScreen } from "./door-screen.js";
import { ExaminerQuestions } from "./examiner-questions.js";
import { StationComplete } from "./station-complete.js";
import { OsceAiSignInDialog } from "./osce-ai-sign-in-dialog.js";

function seedFromText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

// The consultation end is already recorded on the server once the engine has
// moved past the room, so a resumed/reconciled state in these phases must not
// re-fire the end-sync server call.
function isConsultationEnded(phase: OscePhase | undefined): boolean {
  return phase === "examiner_questions" || phase === "debrief";
}

export function OsceScreen({ station, mode }: { station: OsceStation; mode: OsceMode }) {
  const reactSessionId = useId();
  const initialSeed = seedFromText(`${station.id}:${mode}:${reactSessionId}`);
  const storageKey = `medley-osce-ai-session:${station.id}:${mode}`;
  const [restored] = useState<{
    state: OsceState;
    sessionId: string | null;
    revision: number;
    interactionMode: OsceInteractionMode;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null") as {
        state?: OsceState;
        sessionId?: string | null;
        revision?: number;
        interactionMode?: OsceInteractionMode;
      } | null;
      if (
        parsed?.state?.version === 2 &&
        parsed.state.stationId === station.id &&
        parsed.state.mode === mode
      ) {
        return {
          state: parsed.state,
          sessionId: parsed.sessionId ?? null,
          revision: parsed.revision ?? 0,
          interactionMode: parsed.interactionMode ?? "guided",
        };
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
    return null;
  });
  const [seed, setSeed] = useState(restored?.state.sessionSeed ?? initialSeed);
  const [game, setGame] = useState<OsceState>(
    () => restored?.state ?? createInitialOsceState(station, mode, initialSeed),
  );
  const [interactionMode, setInteractionMode] = useState<OsceInteractionMode>(
    restored?.interactionMode ?? "guided",
  );
  const [aiSession, setAiSession] = useState<{ id: string; revision: number } | null>(
    restored?.sessionId ? { id: restored.sessionId, revision: restored.revision } : null,
  );
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [serverPending, setServerPending] = useState(false);
  const [freeFormPending, setFreeFormPending] = useState(false);
  const [freeFormDraft, setFreeFormDraft] = useState("");
  const [freeFormError, setFreeFormError] = useState<string | null>(null);
  const [freeFormRequestId, setFreeFormRequestId] = useState<string | null>(null);
  const [aiNarrative, setAiNarrative] = useState<OsceAiNarrative | null>(null);
  const [aiFeedbackStatus, setAiFeedbackStatus] = useState<
    "idle" | "loading" | "complete" | "failed"
  >("idle");
  const [examinerError, setExaminerError] = useState<string | null>(null);
  const [category, setCategory] = useState<OsceCategory>("opening");
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [examinerExpression, setExaminerExpression] = useState<AmbroseExpression>("neutral");
  const [examinerCoachLine, setExaminerCoachLine] = useState<string | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedReactionIdRef = useRef<string | null>(null);
  const savedCompletionKeyRef = useRef<string | null>(null);
  const resumeCheckedRef = useRef(false);
  const serverEndSyncedRef = useRef(isConsultationEnded(restored?.state.phase));
  const startingAiSessionRef = useRef(false);
  const guidedRequestIdsRef = useRef(new Map<string, string>());
  const nudgeRequestIdRef = useRef<string | null>(null);
  const endRequestIdRef = useRef<string | null>(null);
  const examinerRequestIdsRef = useRef(new Map<string, string>());
  const feedbackRequestIdRef = useRef<string | null>(null);

  const startAiSession = useCallback(async () => {
    if (aiSession) return aiSession;
    if (startingAiSessionRef.current) return null;
    startingAiSessionRef.current = true;
    setServerPending(true);
    setExaminerError(null);
    setFreeFormError(null);
    try {
      const result = await createOsceAiSession({ data: { stationId: station.id, state: game } });
      const session = { id: result.sessionId, revision: result.revision };
      serverEndSyncedRef.current = isConsultationEnded(result.state.phase);
      setAiSession(session);
      setGame(result.state);
      setInteractionMode("free_form");
      setAuthDialogOpen(false);
      return session;
    } catch (error) {
      logProblem("OSCE start AI session", error, { stationId: station.id });
      setFreeFormError(errorMessage(error));
      setInteractionMode("guided");
      return null;
    } finally {
      startingAiSessionRef.current = false;
      setServerPending(false);
    }
  }, [aiSession, game, station.id]);

  const resumeAiSession = useCallback(async (sessionId: string) => {
    setServerPending(true);
    setFreeFormError(null);
    try {
      const result = await resumeOsceAiSession({ data: { sessionId } });
      serverEndSyncedRef.current = isConsultationEnded(result.state.phase);
      setGame(result.state);
      setAiSession({ id: result.sessionId, revision: result.revision });
      setInteractionMode("free_form");
      setAuthDialogOpen(false);
      return true;
    } catch (error) {
      logProblem("OSCE resume AI session", error, { sessionId });
      setAiSession(null);
      setInteractionMode("guided");
      setFreeFormError(errorMessage(error));
      return false;
    } finally {
      setServerPending(false);
    }
  }, []);

  const requestAiFeedback = useCallback(async () => {
    if (!aiSession || !game.interactions.some((item) => item.source === "free_form")) return;
    setAiFeedbackStatus("loading");
    const requestId = feedbackRequestIdRef.current ?? crypto.randomUUID();
    feedbackRequestIdRef.current = requestId;
    try {
      const narrative = await generateOsceAiFeedback({
        data: { sessionId: aiSession.id, clientRequestId: requestId },
      });
      setAiNarrative(narrative);
      setAiFeedbackStatus(narrative ? "complete" : "idle");
      feedbackRequestIdRef.current = null;
    } catch (error) {
      logProblem("OSCE feedback", error, { sessionId: aiSession.id });
      setAiFeedbackStatus("failed");
    }
  }, [aiSession, game.interactions]);

  useEffect(() => {
    if (interactionMode === "guided" && !aiSession && !authDialogOpen) return;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        state: game,
        sessionId: aiSession?.id ?? null,
        revision: aiSession?.revision ?? 0,
        interactionMode,
      }),
    );
  }, [aiSession, authDialogOpen, game, interactionMode, storageKey]);

  useEffect(() => {
    if (resumeCheckedRef.current || restored?.interactionMode !== "free_form") return;
    resumeCheckedRef.current = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        setAiSession(null);
        setAuthDialogOpen(true);
        return;
      }
      if (restored.sessionId) {
        void resumeAiSession(restored.sessionId);
        return;
      }
      void startAiSession();
    });
  }, [restored, resumeAiSession, startAiSession]);

  useEffect(
    () => () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      if (reactionResetTimerRef.current) clearTimeout(reactionResetTimerRef.current);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (game.phase !== "room") {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      if (reactionResetTimerRef.current) clearTimeout(reactionResetTimerRef.current);
      setExaminerCoachLine(null);
      return;
    }

    const reaction = game.examinerReactions.at(-1);
    if (!reaction || displayedReactionIdRef.current === reaction.id) return;
    displayedReactionIdRef.current = reaction.id;
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (reactionResetTimerRef.current) clearTimeout(reactionResetTimerRef.current);
    setExaminerExpression("neutral");
    setExaminerCoachLine(null);

    reactionTimerRef.current = setTimeout(() => {
      setExaminerExpression(reaction.expression);
      setExaminerCoachLine(reaction.coachLine);
      reactionResetTimerRef.current = setTimeout(
        () => {
          setExaminerCoachLine(null);
          if (reaction.expression === "serious_pause") {
            setExaminerExpression("writing");
            reactionResetTimerRef.current = setTimeout(() => {
              setExaminerExpression("neutral");
            }, 1100);
          } else {
            setExaminerExpression("neutral");
          }
        },
        reaction.coachLine ? 4200 : 1800,
      );
    }, reaction.delayMs);
  }, [game.examinerReactions, game.phase]);

  useEffect(() => {
    if (game.status !== "complete" || !game.finalResult) return;
    const completionKey = `${game.stationId}:${game.mode}:${game.sessionSeed}`;
    if (savedCompletionKeyRef.current === completionKey) return;
    saveOsceResult(game.stationId, game.mode, game.finalResult);
    savedCompletionKeyRef.current = completionKey;
  }, [game.finalResult, game.mode, game.sessionSeed, game.stationId, game.status]);

  useEffect(() => {
    if (game.status !== "complete" || aiFeedbackStatus !== "idle") return;
    if (!game.interactions.some((item) => item.source === "free_form")) return;
    void requestAiFeedback();
  }, [aiFeedbackStatus, game.interactions, game.status, requestAiFeedback]);

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
    if (game.phase !== "room" || pendingCardId || freeFormPending || serverPending) return;
    const timer = setInterval(() => {
      setGame((current) =>
        current.phase === "room" ? advanceIdleTime(current, station, 1) : current,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [freeFormPending, game.phase, pendingCardId, serverPending, station]);

  useEffect(() => {
    if (game.curveball.status === "pending") setCategory("communicate");
  }, [game.curveball.status]);

  useEffect(() => {
    if (
      !aiSession ||
      game.phase !== "examiner_questions" ||
      serverEndSyncedRef.current ||
      serverPending
    ) {
      return;
    }
    serverEndSyncedRef.current = true;
    setServerPending(true);
    const requestId = endRequestIdRef.current ?? crypto.randomUUID();
    endRequestIdRef.current = requestId;
    void endOsceAiConsultation({
      data: {
        sessionId: aiSession.id,
        expectedRevision: aiSession.revision,
        clientRequestId: requestId,
        elapsedSecond: station.clockSeconds - game.remainingSeconds,
      },
    })
      .then((result) => {
        setGame(result.state);
        setAiSession({ id: result.sessionId, revision: result.revision });
      })
      .catch((error) => {
        // Keep serverEndSyncedRef `true` so this effect does not re-fire in a
        // loop. The local engine already shows the examiner questions; the end
        // is a best-effort server sync and must not thrash on failure.
        logProblem("OSCE end consultation sync", error, { sessionId: aiSession.id });
      })
      .finally(() => setServerPending(false));
  }, [aiSession, game.phase, game.remainingSeconds, serverPending, station.clockSeconds]);

  async function chooseCard(card: OsceCard) {
    if (pendingCardId || freeFormPending || serverPending) return;
    setPendingCardId(card.id);
    const reply = card.replies[getRapportBand(game.rapport)];
    const delay = Math.round(Math.min(1500, Math.max(800, 720 + reply.length * 7)));
    if (aiSession) {
      const requestId = guidedRequestIdsRef.current.get(card.id) ?? crypto.randomUUID();
      guidedRequestIdsRef.current.set(card.id, requestId);
      try {
        const [result] = await Promise.all([
          recordOsceGuidedAction({
            data: {
              sessionId: aiSession.id,
              expectedRevision: aiSession.revision,
              clientRequestId: requestId,
              elapsedSecond: station.clockSeconds - game.remainingSeconds,
              cardId: card.id,
            },
          }),
          new Promise((resolve) => setTimeout(resolve, delay)),
        ]);
        setGame(result.state);
        setAiSession({ id: result.sessionId, revision: result.revision });
        guidedRequestIdsRef.current.delete(card.id);
      } catch (error) {
        logProblem("OSCE guided action", error, { cardId: card.id, sessionId: aiSession.id });
        setNudgeMessage(`That action was not saved. ${errorMessage(error)}`);
      } finally {
        setPendingCardId(null);
      }
      return;
    }
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

  async function changeInteractionMode(nextMode: OsceInteractionMode) {
    if (nextMode === interactionMode || pendingCardId || freeFormPending || serverPending) return;
    noteActivity();
    if (nextMode === "guided") {
      setInteractionMode("guided");
      return;
    }
    setInteractionMode("free_form");
    if (aiSession) return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await startAiSession();
      return;
    }
    setAuthDialogOpen(true);
  }

  async function submitFreeForm() {
    const studentInput = freeFormDraft.trim();
    if (!studentInput || !aiSession || freeFormPending || serverPending) return;
    const requestId = freeFormRequestId ?? crypto.randomUUID();
    setFreeFormRequestId(requestId);
    setFreeFormPending(true);
    setFreeFormError(null);
    try {
      const result = await submitOsceFreeFormInteraction({
        data: {
          sessionId: aiSession.id,
          expectedRevision: aiSession.revision,
          clientRequestId: requestId,
          elapsedSecond: station.clockSeconds - game.remainingSeconds,
          studentInput,
        },
      });
      setGame(result.state);
      setAiSession({ id: result.sessionId, revision: result.revision });
      setFreeFormDraft("");
      setFreeFormRequestId(null);
    } catch (error) {
      logProblem("OSCE free-form interaction", error, { sessionId: aiSession.id });
      setFreeFormError(errorMessage(error));
    } finally {
      setFreeFormPending(false);
    }
  }

  async function handleNudge() {
    const nudge = station.nudges[game.nudgesUsed.length];
    if (!nudge) return;
    if (aiSession) {
      setServerPending(true);
      const requestId = nudgeRequestIdRef.current ?? crypto.randomUUID();
      nudgeRequestIdRef.current = requestId;
      try {
        const result = await requestOsceAiNudge({
          data: {
            sessionId: aiSession.id,
            expectedRevision: aiSession.revision,
            clientRequestId: requestId,
            elapsedSecond: station.clockSeconds - game.remainingSeconds,
          },
        });
        setGame(result.state);
        setAiSession({ id: result.sessionId, revision: result.revision });
        setNudgeMessage(result.state.nudgesUsed.at(-1)?.text ?? nudge.text);
        nudgeRequestIdRef.current = null;
      } catch (error) {
        logProblem("OSCE nudge", error, { sessionId: aiSession.id });
        setNudgeMessage(`A nudge is unavailable. ${errorMessage(error)}`);
      } finally {
        setServerPending(false);
      }
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = setTimeout(() => setNudgeMessage(null), 4500);
      return;
    }
    setGame((current) => requestNudge(current, station));
    setNudgeMessage(nudge.text);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => setNudgeMessage(null), 4500);
  }

  async function finishConsultation() {
    if (!aiSession) {
      setGame((current) => endConsultation(current, station));
      return;
    }
    setServerPending(true);
    const requestId = endRequestIdRef.current ?? crypto.randomUUID();
    endRequestIdRef.current = requestId;
    try {
      const result = await endOsceAiConsultation({
        data: {
          sessionId: aiSession.id,
          expectedRevision: aiSession.revision,
          clientRequestId: requestId,
          elapsedSecond: station.clockSeconds - game.remainingSeconds,
        },
      });
      setGame(result.state);
      setAiSession({ id: result.sessionId, revision: result.revision });
      serverEndSyncedRef.current = true;
    } catch (error) {
      logProblem("OSCE end consultation", error, { sessionId: aiSession.id });
      setNudgeMessage(`The consultation could not end. ${errorMessage(error)}`);
    } finally {
      setServerPending(false);
    }
  }

  async function submitExaminerAnswer(questionId: string, selectedIds: string[]) {
    if (!aiSession) {
      setGame((current) => answerExaminerQuestion(current, station, questionId, selectedIds));
      return;
    }
    setServerPending(true);
    setExaminerError(null);
    const requestId = examinerRequestIdsRef.current.get(questionId) ?? crypto.randomUUID();
    examinerRequestIdsRef.current.set(questionId, requestId);
    try {
      const result = await answerOsceAiExaminerQuestion({
        data: {
          sessionId: aiSession.id,
          expectedRevision: aiSession.revision,
          clientRequestId: requestId,
          elapsedSecond: station.clockSeconds - game.remainingSeconds,
          questionId,
          selectedOptionIds: selectedIds,
        },
      });
      setGame(result.state);
      setAiSession({ id: result.sessionId, revision: result.revision });
      examinerRequestIdsRef.current.delete(questionId);
    } catch (error) {
      logProblem("OSCE examiner question", error, { sessionId: aiSession.id });
      setExaminerError(errorMessage(error));
    } finally {
      setServerPending(false);
    }
  }

  function retry() {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    const nextSeed = (seed + 1) >>> 0;
    setSeed(nextSeed);
    setGame(createInitialOsceState(station, mode, nextSeed));
    setInteractionMode("guided");
    setAiSession(null);
    setAuthDialogOpen(false);
    setServerPending(false);
    setFreeFormPending(false);
    setFreeFormDraft("");
    setFreeFormError(null);
    setFreeFormRequestId(null);
    setAiNarrative(null);
    setAiFeedbackStatus("idle");
    setExaminerError(null);
    window.sessionStorage.removeItem(storageKey);
    serverEndSyncedRef.current = false;
    guidedRequestIdsRef.current.clear();
    nudgeRequestIdRef.current = null;
    endRequestIdRef.current = null;
    examinerRequestIdsRef.current.clear();
    feedbackRequestIdRef.current = null;
    setCategory("opening");
    setPendingCardId(null);
    setExaminerExpression("neutral");
    setExaminerCoachLine(null);
    setNudgeMessage(null);
    displayedReactionIdRef.current = null;
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
      <>
        <ConsultationRoom
          game={game}
          station={station}
          mode={mode}
          interactionMode={interactionMode}
          category={category}
          pendingCardId={pendingCardId}
          freeFormPending={freeFormPending || serverPending}
          freeFormDraft={freeFormDraft}
          freeFormError={freeFormError}
          examinerExpression={nudgeMessage ? "thinking" : examinerExpression}
          examinerMessage={nudgeMessage ?? examinerCoachLine}
          onCategoryChange={setCategory}
          onInteractionModeChange={(nextMode) => void changeInteractionMode(nextMode)}
          onChoose={(card) => void chooseCard(card)}
          onFreeFormDraftChange={setFreeFormDraft}
          onFreeFormSubmit={() => void submitFreeForm()}
          onFreeFormRetry={() => void submitFreeForm()}
          onFreeFormEdit={() => {
            setFreeFormError(null);
            setFreeFormRequestId(null);
          }}
          onEnd={() => void finishConsultation()}
          onNudge={() => void handleNudge()}
          onActivity={noteActivity}
        />
        <OsceAiSignInDialog
          open={authDialogOpen}
          onOpenChange={(open) => {
            setAuthDialogOpen(open);
            if (!open && !aiSession) setInteractionMode("guided");
          }}
          onAuthenticated={() =>
            void (restored?.sessionId ? resumeAiSession(restored.sessionId) : startAiSession())
          }
        />
      </>
    );
  }

  if (game.phase === "examiner_questions") {
    return (
      <ExaminerQuestions
        game={game}
        station={station}
        pending={serverPending}
        error={examinerError}
        onAnswer={(questionId, selectedIds) => void submitExaminerAnswer(questionId, selectedIds)}
      />
    );
  }

  return (
    <StationComplete
      game={game}
      station={station}
      onRetry={retry}
      aiNarrative={aiNarrative}
      aiFeedbackStatus={aiFeedbackStatus}
      onRetryAiFeedback={() => void requestAiFeedback()}
    />
  );
}
