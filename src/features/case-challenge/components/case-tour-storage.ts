/** Per-browser memory of the case tour, like the anatomy lab's tour. */
const STORAGE_KEY = "medley-case-tour";

/** Whether this browser has finished or skipped the case tour before. */
export function hasSeenCaseTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Storage blocked (private mode etc.): don't nag on every visit.
    return true;
  }
}

export function markCaseTourSeen(how: "done" | "skipped") {
  try {
    window.localStorage.setItem(STORAGE_KEY, how);
  } catch {
    /* storage blocked: closing is enough */
  }
}
