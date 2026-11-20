import { useCallback, useEffect, useRef, useState } from "react";
import type { MedicalCase } from "@/features/case-challenge/schema";
import { uploadCaseImage, type UploadedImage } from "./image-upload";
import {
  createStudioCase,
  discardStudioDraft,
  listStudioCases,
  publishStudioCase,
  reviseStudioCase,
  saveStudioDraft,
  type StudioCase,
} from "./studio.functions";

/*
 * The shared case library as the studio sees it, with autosave.
 *
 * Edits apply locally at once and are written to the server shortly after
 * typing stops. Each save names the version it was based on; if someone else
 * saved or published in between, the case is marked "conflict" and nothing
 * more is written until the editor chooses whose version to keep.
 */

export type SaveState =
  | { kind: "saved"; at: string }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict" };

export type PublishOutcome =
  | { status: "published" }
  | { status: "invalid"; problems: string[] }
  | { status: "conflict" }
  | { status: "error"; message: string };

const SAVE_DELAY_MS = 700;
const RETRY_DELAY_MS = 5000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useStudioCases() {
  const [cases, setCases] = useState<StudioCase[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const versions = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, MedicalCase>());
  const timers = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  // Server copy at the moment a conflict was detected (null: case deleted).
  const conflicts = useRef(new Map<string, StudioCase | null>());

  const setSaveState = useCallback((id: string, state: SaveState) => {
    setSaveStates((current) => ({ ...current, [id]: state }));
  }, []);

  const upsert = useCallback((row: StudioCase) => {
    versions.current.set(row.id, row.version);
    setCases((current) => {
      const list = current ?? [];
      return list.some((item) => item.id === row.id)
        ? list.map((item) => (item.id === row.id ? row : item))
        : [...list, row];
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    versions.current.delete(id);
    pending.current.delete(id);
    setCases((current) => (current ?? []).filter((item) => item.id !== id));
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const rows = await listStudioCases();
      rows.forEach((row) => versions.current.set(row.id, row.version));
      setCases(rows);
    } catch (error) {
      setLoadError(message(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(
    async (id: string): Promise<void> => {
      window.clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      if (inFlight.current.has(id) || conflicts.current.has(id)) return;
      const definition = pending.current.get(id);
      if (!definition) return;
      pending.current.delete(id);
      inFlight.current.add(id);
      let retry = false;
      try {
        const result = await saveStudioDraft({
          data: {
            id,
            definition: definition as unknown as Record<string, unknown>,
            expectedVersion: versions.current.get(id) ?? 1,
          },
        });
        if (result.status === "saved") {
          const row = result.case;
          versions.current.set(id, row.version);
          setCases((current) =>
            (current ?? []).map((item) =>
              item.id === id
                ? {
                    ...item,
                    version: row.version,
                    updatedAt: row.updatedAt,
                    published: row.published,
                    // Keep newer local edits that are still waiting to be saved.
                    draft: pending.current.has(id) ? item.draft : row.draft,
                  }
                : item,
            ),
          );
          if (!pending.current.has(id)) setSaveState(id, { kind: "saved", at: row.updatedAt });
        } else {
          if (!pending.current.has(id)) pending.current.set(id, definition);
          conflicts.current.set(id, result.case);
          setSaveState(id, { kind: "conflict" });
        }
      } catch (error) {
        if (!pending.current.has(id)) pending.current.set(id, definition);
        setSaveState(id, { kind: "error", message: message(error) });
        retry = true;
      } finally {
        inFlight.current.delete(id);
      }
      if (pending.current.has(id) && !conflicts.current.has(id)) {
        const delay = retry ? RETRY_DELAY_MS : 0;
        timers.current.set(
          id,
          window.setTimeout(() => void flush(id), delay),
        );
      }
    },
    [setSaveState],
  );

  /** Apply an edit to a case's draft now and save it shortly. */
  const editDraft = useCallback(
    (id: string, definition: MedicalCase) => {
      setCases((current) =>
        (current ?? []).map((item) => (item.id === id ? { ...item, draft: definition } : item)),
      );
      pending.current.set(id, definition);
      if (conflicts.current.has(id)) return;
      setSaveState(id, { kind: "saving" });
      window.clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        window.setTimeout(() => void flush(id), SAVE_DELAY_MS),
      );
    },
    [flush, setSaveState],
  );

  /** Wait until nothing is waiting to be written for this case. */
  const settle = useCallback(
    async (id: string) => {
      await flush(id);
      for (let i = 0; i < 100 && (inFlight.current.has(id) || pending.current.has(id)); i += 1) {
        if (conflicts.current.has(id)) break;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        if (!inFlight.current.has(id)) await flush(id);
      }
    },
    [flush],
  );

  // Write anything outstanding before leaving, and warn if it can't finish.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current.size || inFlight.current.size) {
        for (const id of pending.current.keys()) void flush(id);
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    const pendingSaves = pending.current;
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const id of pendingSaves.keys()) void flush(id);
    };
  }, [flush]);

  const resolveConflict = useCallback(
    async (id: string, keep: "mine" | "theirs") => {
      const server = conflicts.current.get(id);
      conflicts.current.delete(id);
      if (keep === "theirs") {
        pending.current.delete(id);
        if (server) {
          upsert(server);
          setSaveState(id, { kind: "saved", at: server.updatedAt });
        } else {
          removeLocal(id);
        }
        return;
      }
      if (server) versions.current.set(id, server.version);
      setSaveState(id, { kind: "saving" });
      await flush(id);
    },
    [flush, removeLocal, setSaveState, upsert],
  );

  const createCase = useCallback(
    async (definition: MedicalCase, keepIdentity = false) => {
      const row = await createStudioCase({
        data: { definition: definition as unknown as Record<string, unknown>, keepIdentity },
      });
      upsert(row);
      setSaveState(row.id, { kind: "saved", at: row.updatedAt });
      return row;
    },
    [setSaveState, upsert],
  );

  const reviseCase = useCallback(
    async (id: string) => {
      const row = await reviseStudioCase({ data: { id } });
      upsert(row);
      setSaveState(row.id, { kind: "saved", at: row.updatedAt });
      return row;
    },
    [setSaveState, upsert],
  );

  const publish = useCallback(
    async (id: string): Promise<PublishOutcome> => {
      try {
        await settle(id);
        if (conflicts.current.has(id)) return { status: "conflict" };
        const result = await publishStudioCase({
          data: { id, expectedVersion: versions.current.get(id) ?? 1 },
        });
        if (result.status === "published") {
          upsert(result.case);
          setSaveState(id, { kind: "saved", at: result.case.updatedAt });
          return { status: "published" };
        }
        if (result.status === "invalid") return result;
        conflicts.current.set(id, result.case);
        setSaveState(id, { kind: "conflict" });
        return { status: "conflict" };
      } catch (error) {
        return { status: "error", message: message(error) };
      }
    },
    [setSaveState, settle, upsert],
  );

  const discard = useCallback(
    async (id: string) => {
      window.clearTimeout(timers.current.get(id));
      pending.current.delete(id);
      conflicts.current.delete(id);
      const row = await discardStudioDraft({ data: { id } });
      if (row) {
        upsert(row);
        setSaveState(id, { kind: "saved", at: row.updatedAt });
      } else {
        removeLocal(id);
      }
    },
    [removeLocal, setSaveState, upsert],
  );

  const uploadImage = useCallback(
    (caseId: string, file: File): Promise<UploadedImage> => uploadCaseImage(caseId, file),
    [],
  );

  return {
    cases,
    loadError,
    reload: load,
    saveStates,
    editDraft,
    resolveConflict,
    createCase,
    reviseCase,
    publish,
    discard,
    uploadImage,
  };
}
