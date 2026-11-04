"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  begin,
  cancel,
  fail,
  initialTimelineState,
  succeed,
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
  // Route of the Log a Win form, for the empty state's primary action.
  logWinHref?: string;
};

export default function Timeline({ logWinHref = "/wins/new" }: Props) {
  const [state, setState] = useState<TimelineState>(initialTimelineState);
  // Mirrors `state` synchronously so a second click before re-render is still ignored.
  const stateRef = useRef(state);
  const controllerRef = useRef<AbortController | null>(null);

  const commit = useCallback((next: TimelineState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(async () => {
    const started = begin(stateRef.current);
    if (started === stateRef.current) return;
    commit(started);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/wins", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data: { wins?: unknown } = await response.json();
      if (!Array.isArray(data.wins)) throw new Error("Malformed response");
      commit(succeed(stateRef.current, started.requestId, data.wins as TimelineWin[]));
    } catch {
      commit(fail(stateRef.current, started.requestId));
    }
  }, [commit]);

  useEffect(() => {
    void load();
    return () => {
      controllerRef.current?.abort();
      commit(cancel(stateRef.current));
    };
  }, [load, commit]);

  const loading = state.status === "idle" || state.status === "loading";

  return (
    <section aria-label="Your wins" aria-busy={loading} className="space-y-4">
      <p role="status" className="sr-only">
        {loading
          ? "Loading wins…"
          : state.status === "success"
            ? `${state.wins.length} ${state.wins.length === 1 ? "win" : "wins"} loaded.`
            : ""}
      </p>

      {loading && (
        <ul aria-hidden="true" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="animate-pulse space-y-2 rounded-lg border border-neutral-200 p-4">
              <div className="h-4 w-3/4 rounded bg-neutral-200" />
              <div className="h-3 w-1/3 rounded bg-neutral-200" />
            </li>
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Couldn&apos;t load your wins.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 bg-white px-3 py-2 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "success" && state.wins.length === 0 && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center">
          <p className="text-neutral-700">No wins yet</p>
          <a
            href={logWinHref}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Log your first win
          </a>
        </div>
      )}

      {state.status === "success" && state.wins.length > 0 && (
        <ul className="space-y-3">
          {state.wins.map((win) => (
            <li key={win.id} className="space-y-2 rounded-lg border border-neutral-200 p-4">
              {win.photoUrl && (
                <img src={win.photoUrl} alt="" className="max-h-64 w-full rounded object-cover" />
              )}
              <p>{win.reflection}</p>
              <p className="text-sm text-neutral-600">
                {CATEGORY_LABELS[win.category] ?? win.category} ·{" "}
                <time dateTime={win.createdAt}>
                  {new Date(win.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
