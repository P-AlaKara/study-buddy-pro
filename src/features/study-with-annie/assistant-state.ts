import type { AssistantMessage, AssistantStatus, RecallChallenge } from "./types";

export type AssistantView = {
  status: AssistantStatus;
  expanded: boolean;
  message: AssistantMessage | null;
  challenge: RecallChallenge | null;
};

export type AssistantAction =
  | { type: "think" }
  | { type: "show"; message: AssistantMessage }
  | { type: "expand" }
  | { type: "collapse" }
  | { type: "start_recall"; challenge: RecallChallenge }
  | { type: "feedback"; message: AssistantMessage }
  | { type: "dismiss" };

export const initialAssistantView: AssistantView = {
  status: "idle",
  expanded: false,
  message: null,
  challenge: null,
};

export function assistantReducer(state: AssistantView, action: AssistantAction): AssistantView {
  switch (action.type) {
    case "think":
      return { ...state, status: "thinking", message: null };
    case "show":
      return {
        status: "speaking",
        expanded: state.expanded,
        message: action.message,
        challenge: null,
      };
    case "expand":
      return { ...state, expanded: true, status: state.challenge ? "awaiting_answer" : "expanded" };
    case "collapse":
      return {
        ...state,
        expanded: false,
        status: state.challenge ? "awaiting_answer" : state.message ? "speaking" : "idle",
      };
    case "start_recall":
      return {
        status: "awaiting_answer",
        expanded: true,
        message: { kind: "recall", challenge: action.challenge },
        challenge: action.challenge,
      };
    case "feedback":
      return { status: "feedback", expanded: true, message: action.message, challenge: null };
    case "dismiss":
      return initialAssistantView;
  }
}
