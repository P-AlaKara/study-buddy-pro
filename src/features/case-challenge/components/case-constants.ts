import { type ComponentType } from "react";
import {
  ClipboardList,
  FlaskConical,
  ListOrdered,
  MessageCircleMore,
  NotebookPen,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type { ActionCategory } from "../schema.js";

export type RightTab = "chart" | "notes" | "differential";
export type AvatarReaction = ActionCategory | null;

/**
 * The three clinical tools. Each one opens on its own — the workspace shows a
 * single tool at a time rather than a tab strip, so a first-time user is never
 * asked to choose between three screens they have not seen yet.
 */
export const WORKSPACE_TOOLS: RightTab[] = ["chart", "notes", "differential"];

export const workspaceToolMeta: Record<
  RightTab,
  {
    /** Short label for the launcher. */
    label: string;
    /** One line explaining what the tool is for. */
    blurb: string;
    /** Names what the launcher's count refers to, for screen readers. */
    unit: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  chart: {
    label: "Patient chart",
    blurb: "Everything you have found so far",
    unit: "findings recorded",
    icon: ClipboardList,
  },
  notes: {
    label: "Clinical notes",
    blurb: "Your own scratchpad for this case",
    unit: "",
    icon: NotebookPen,
  },
  differential: {
    label: "Differentials",
    blurb: "List and rank your working diagnoses",
    unit: "diagnoses listed",
    icon: ListOrdered,
  },
};

/**
 * Per-category presentation. `color`/`soft`/`ink` are CSS custom-property
 * references so the whole simulator palette lives in `styles.css`. Each of the
 * four clinical interaction categories gets a distinct on-brand accent: Ask →
 * blue, Examine → purple, Test → mint, Treat → pink.
 */
export const categoryMeta: Record<
  ActionCategory,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    color: string;
    soft: string;
    ink: string;
    /** Saturated pastel for the dock's clay buttons (soft is for light surfaces). */
    pastel: string;
  }
> = {
  ask: {
    label: "Ask",
    icon: MessageCircleMore,
    color: "var(--case-blue)",
    soft: "var(--case-blue-soft)",
    ink: "var(--case-blue-ink)",
    pastel: "#bde8ff",
  },
  examine: {
    label: "Examine",
    icon: Stethoscope,
    color: "var(--case-accent)",
    soft: "var(--case-accent-soft)",
    ink: "var(--case-accent-ink)",
    pastel: "#e9c7ff",
  },
  test: {
    label: "Test",
    icon: FlaskConical,
    color: "var(--case-mint)",
    soft: "var(--case-mint-soft)",
    ink: "var(--case-mint-ink)",
    pastel: "#b9f5e4",
  },
  treat: {
    label: "Treat",
    icon: Syringe,
    color: "var(--case-pink)",
    soft: "var(--case-pink-soft)",
    ink: "var(--case-pink-ink)",
    pastel: "#ffd0e8",
  },
};

export function engineMessage(error: unknown): string {
  return error instanceof Error ? error.message : "That move could not be completed.";
}

export function typingDelay(content: string): number {
  return Math.min(1500, Math.max(800, 650 + content.length * 5));
}

export function actionCategoryLabel(category: ActionCategory): string {
  if (category === "ask") return "History taking";
  if (category === "examine") return "Physical examination";
  if (category === "test") return "Diagnostic investigation";
  return "Treatment";
}
