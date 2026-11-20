import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { ActionCategory, CaseAction, MedicalCase } from "@/features/case-challenge/schema";
import type { StudioCheck } from "../issue-guide";
import { GROUP_PRESETS, UNGROUPED, type BuildStep } from "../vocabulary";

export interface JumpTarget {
  step: BuildStep;
  actionId?: string;
  anchor?: string;
}

export interface FocusRequest {
  actionId?: string;
  anchor?: string;
  /** Open the targeted action straight into its editor. */
  edit?: boolean;
  nonce: number;
}

/** Present when the open case can be changed (a draft or a revision). */
export interface CaseEditor {
  definition: MedicalCase;
  onChange: (next: MedicalCase) => void;
  checks: StudioCheck[];
  onAddImage: () => void;
  /** Upload an image file for this case; resolves to its stored location. */
  uploadImage: (file: File) => Promise<{ url: string; fileName: string }>;
}

/** Publishing the open draft (drafts only). */
export interface PublishControl {
  run: () => void;
  disabled: boolean;
  busy: boolean;
  /** Changes to a live case, rather than a new case. */
  isChange: boolean;
}

export interface WorkspaceApi {
  /** The last jump; cards and fields react to it once per nonce. */
  focus: FocusRequest | null;
  /** Go to a step (in the current mode) and reveal the target. */
  jump: (target: JumpTarget) => void;
  /**
   * Start editing a target. Actions open their editor in place; anything else
   * opens the builder at that field. A published case first becomes a revision.
   */
  edit?: ((target: JumpTarget) => void) | undefined;
  editor?: CaseEditor | undefined;
  publish?: PublishControl | undefined;
}

const WorkspaceContext = createContext<WorkspaceApi>({ focus: null, jump: () => {} });

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

/** Calls `reveal` when a jump targets this action. */
export function useFocusAction(actionId: string, reveal: (request: FocusRequest) => void) {
  const { focus } = useWorkspace();
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (focus?.actionId === actionId && handled.current !== focus.nonce) {
      handled.current = focus.nonce;
      reveal(focus);
    }
  }, [focus, actionId, reveal]);
}

/** Stable React keys for actions whose ids change while their label is typed. */
export function useStableKeys() {
  const map = useRef(new Map<string, string>());
  const counter = useRef(0);
  const keyFor = useCallback((id: string) => {
    let key = map.current.get(id);
    if (!key) {
      key = `action-${counter.current++}`;
      map.current.set(id, key);
    }
    return key;
  }, []);
  const rename = useCallback((from: string, to: string) => {
    const key = map.current.get(from);
    if (key) {
      map.current.delete(from);
      map.current.set(to, key);
    }
  }, []);
  return { keyFor, rename };
}

export interface ActionGroup {
  name: string;
  actions: CaseAction[];
}

/** Actions of one category under their clinical headings, presets first. */
export function groupActions(
  actions: readonly CaseAction[],
  category: ActionCategory,
): ActionGroup[] {
  const groups = new Map<string, CaseAction[]>();
  for (const action of actions) {
    if (action.category !== category) continue;
    const name = action.group?.trim() || UNGROUPED;
    groups.set(name, [...(groups.get(name) ?? []), action]);
  }
  const presets = GROUP_PRESETS[category];
  const rank = (name: string) => {
    if (name === UNGROUPED) return 10_000;
    const index = presets.indexOf(name);
    return index === -1 ? 1_000 : index;
  };
  return [...groups.entries()]
    .map(([name, list]) => ({ name, actions: list }))
    .sort((a, b) => rank(a.name) - rank(b.name));
}

export function scrollToAnchor(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = element.querySelector<HTMLElement>(
    "input, textarea, select, button[aria-expanded], button",
  );
  focusable?.focus({ preventScroll: true });
  element.classList.remove("studio-flash");
  void element.offsetWidth;
  element.classList.add("studio-flash");
  return true;
}
