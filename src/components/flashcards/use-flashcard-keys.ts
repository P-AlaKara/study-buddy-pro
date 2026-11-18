import { useEffect, useRef } from "react";

type Handlers = {
  flip?: (() => void) | undefined;
  prev?: (() => void) | undefined;
  next?: (() => void) | undefined;
  /** Number keys 1–4 (Again / Hard / Good / Easy). */
  rate?: ((n: 1 | 2 | 3 | 4) => void) | undefined;
};

/**
 * Window-level flashcard shortcuts: ← / → navigate, Space / Enter flip,
 * 1–4 rate. Ignored while typing, while a modal is open, and for Space/Enter
 * when a button or link has focus (its own activation wins).
 */
export function useFlashcardKeys(handlers: Handlers, enabled = true) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (
        t?.closest(
          "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='slider'], [role='tablist'], [role='radiogroup']",
        )
      )
        return;
      if (document.querySelector("[aria-modal='true']")) return;
      const h = ref.current;
      const run = (fn?: () => void) => {
        if (!fn) return;
        e.preventDefault();
        fn();
      };
      switch (e.key) {
        case "ArrowLeft":
          return run(h.prev);
        case "ArrowRight":
          return run(h.next);
        case " ":
        case "Enter":
          if (t?.closest("button, a, summary, [role='button']")) return;
          return run(h.flip);
        case "1":
        case "2":
        case "3":
        case "4": {
          const n = Number(e.key) as 1 | 2 | 3 | 4;
          return run(h.rate && (() => h.rate!(n)));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
