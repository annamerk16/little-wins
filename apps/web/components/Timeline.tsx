"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryFilterValue } from "./CategoryFilter";
import DeleteWinDialog, { DeleteWinError } from "./DeleteWinDialog";
import {
  begin,
  cancel,
  fail,
  initialTimelineState,
  removeWin,
  restoreWin,
  succeed,
  visibleWins,
  type TimelineState,
  type TimelineWin,
} from "./timeline-state";

const CATEGORY_LABELS: Record<string, string> = {
  FITNESS: "Fitness",
  ACADEMIC: "Academic",
  CAREER: "Career",
  PERSONAL: "Personal",
};

type Props = {
  logWinHref?: string;
  onLogWin?: () => void;
  category?: CategoryFilterValue;
  refreshKey?: number;
};

export default function Timeline({
  logWinHref = "/sandbox/log-win",
  onLogWin,
  category = "",
  refreshKey = 0,
}: Props) {
  const [state, setState] = useState<TimelineState>(initialTimelineState);
  const stateRef = useRef(state);
  const controllerRef = useRef<AbortController | null>(null);
  const categoryRef = useRef(category);
  const mountedRef = useRef(false);
  const hiddenIds = useRef(new Set<string>());
  const pendingDelete = useRef<string | null>(null);
  const [selectedWin, setSelectedWin] = useState<TimelineWin | null>(null);
  const [notice, setNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  categoryRef.current = category;

  const commit = useCallback((next: TimelineState) => {
    if (next === stateRef.current || !mountedRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(async (supersede = false) => {
    const started = begin(stateRef.current, supersede);
    if (started === stateRef.current) return;
    controllerRef.current?.abort();
    commit(started);
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedCategory = categoryRef.current;
    const url = requestedCategory
      ? `/api/wins?category=${encodeURIComponent(requestedCategory)}` : "/api/wins";
    let message: string | undefined;
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (response.status === 401) message = "Please sign in to see your wins.";
      if (!response.ok) throw new Error("Unable to load wins");
      const data: { wins?: unknown } = await response.json();
      if (!Array.isArray(data.wins)) throw new Error("Malformed response");
      if (controller.signal.aborted || requestedCategory !== categoryRef.current) return;
      const wins = visibleWins(data.wins as TimelineWin[], hiddenIds.current);
      commit(succeed(stateRef.current, started.requestId, wins));
    } catch {
      if (controller.signal.aborted || requestedCategory !== categoryRef.current) return;
      commit(fail(stateRef.current, started.requestId, message));
    }
  }, [commit]);

  useEffect(() => {
    mountedRef.current = true;
    void load(true);
    return () => {
      controllerRef.current?.abort();
      // Update the ref before the next effect starts; don't set state on unmount.
      stateRef.current = cancel(stateRef.current);
      mountedRef.current = false;
    };
  }, [category, refreshKey, load]);

  async function deleteSelected() {
    if (!selectedWin || pendingDelete.current) return;
    const win = selectedWin;
    const originalIndex = stateRef.current.status === "success"
      ? stateRef.current.wins.findIndex((row) => row.id === win.id) : undefined;
    pendingDelete.current = win.id;
    hiddenIds.current.add(win.id);
    setDeleteError("");
    setNotice("");
    commit(removeWin(stateRef.current, win.id));
    try {
      const response = await fetch(`/api/wins/${encodeURIComponent(win.id)}`, { method: "DELETE" });
      if (response.status === 401) throw new DeleteWinError("Please sign in to delete this win.");
      if (!response.ok) throw new Error("Unable to delete win");
      if (mountedRef.current) {
        setNotice("Win deleted.");
        void load(true);
      }
    } catch (failure) {
      hiddenIds.current.delete(win.id);
      if (mountedRef.current) {
        commit(restoreWin(stateRef.current, win, categoryRef.current, originalIndex));
        setDeleteError(failure instanceof DeleteWinError ? failure.message : "Couldn't delete this win. Try again.");
      }
      throw failure;
    } finally {
      pendingDelete.current = null;
    }
  }

  function closeDelete() {
    setSelectedWin(null);
    const target = returnFocus.current?.isConnected ? returnFocus.current : headingRef.current;
    target?.focus();
  }

  const loading = state.status === "idle" || state.status === "loading";

  return (
    <section aria-label="Your wins" aria-busy={loading} className="space-y-4">
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold text-[#2b4a27]">Your wins</h2>
      <p role="status" className="sr-only">
        {loading
          ? "Loading wins…"
          : state.status === "success"
            ? `${state.wins.length} ${state.wins.length === 1 ? "win" : "wins"} loaded.` : ""}
      </p>
      {notice && <p role="status" className="text-sm text-[#2b4a27]">{notice}</p>}
      {deleteError && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{deleteError}</p>
      )}
      {loading && (
        <ul aria-hidden="true" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="animate-pulse space-y-2 rounded-xl border border-neutral-200 p-4">
              <div className="h-4 w-3/4 rounded bg-neutral-200" />
              <div className="h-3 w-1/3 rounded bg-neutral-200" />
            </li>
          ))}
        </ul>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">{state.message ?? "Couldn't load your wins."}</p>
          <button type="button" onClick={() => void load()} className="rounded border border-red-300 bg-white px-3 py-2">Retry</button>
        </div>
      )}
      {state.status === "success" && state.wins.length === 0 && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-[#e9f0e2]/50 p-6 text-center">
          <p className="text-neutral-700">{category ? "No wins in this category yet." : "No wins yet"}</p>
          {onLogWin ? (
            <button type="button" onClick={onLogWin} className="rounded-full bg-[#2f5a3c] px-4 py-2 font-semibold text-white">Log your first win</button>
          ) : (
            <a href={logWinHref} className="inline-block rounded-full bg-[#2f5a3c] px-4 py-2 font-semibold text-white">Log your first win</a>
          )}
        </div>
      )}
      {state.status === "success" && state.wins.length > 0 && (
        <ul className="space-y-3">
          {state.wins.map((win) => (
            <li key={win.id} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
              {win.photoUrl && <img src={win.photoUrl} alt="" className="max-h-64 w-full rounded object-cover" />}
              <p className="whitespace-pre-wrap break-words">{win.reflection}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-600">
                  {CATEGORY_LABELS[win.category] ?? win.category} ·{" "}
                  <time dateTime={win.createdAt}>{new Date(win.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time>
                </p>
                <button type="button" onClick={(event) => {
                  returnFocus.current = event.currentTarget;
                  setDeleteError("");
                  setSelectedWin(win);
                }} className="rounded border border-red-200 px-3 py-2 text-sm text-red-700">
                  Delete<span className="sr-only"> win: {win.reflection}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {selectedWin && (
        <DeleteWinDialog open winText={selectedWin.reflection} onConfirm={deleteSelected} onClose={closeDelete} />
      )}
    </section>
  );
}
