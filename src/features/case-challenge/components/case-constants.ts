import { type ComponentType } from "react";
import { FlaskConical, MessageCircleMore, Stethoscope, Syringe } from "lucide-react";
import type { ActionCategory } from "../schema.js";

export type RightTab = "chart" | "notes" | "differential";
export type AvatarReaction = ActionCategory | null;

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
  }
> = {
  ask: {
    label: "Ask",
    icon: MessageCircleMore,
    color: "var(--case-blue)",
    soft: "var(--case-blue-soft)",
    ink: "var(--case-blue-ink)",
  },
  examine: {
    label: "Examine",
    icon: Stethoscope,
    color: "var(--case-accent)",
    soft: "var(--case-accent-soft)",
    ink: "var(--case-accent-ink)",
  },
  test: {
    label: "Test",
    icon: FlaskConical,
    color: "var(--case-mint)",
    soft: "var(--case-mint-soft)",
    ink: "var(--case-mint-ink)",
  },
  treat: {
    label: "Treat",
    icon: Syringe,
    color: "var(--case-pink)",
    soft: "var(--case-pink-soft)",
    ink: "var(--case-pink-ink)",
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
