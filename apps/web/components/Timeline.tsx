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
            <li key={i} className="animate-pulse space-y-3 rounded-[22px] bg-[#fdfdfb] p-6 text-[#1e2b1b] shadow-[0_10px_24px_-10px_rgba(30,43,27,0.25),0_0_0_1px_rgba(30,43,27,0.08)]">
              <div className="h-4 w-3/4 rounded-full bg-[#e9f0e2]" />
              <div className="h-3 w-1/3 rounded-full bg-[#dce6d3]" />
            </li>
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div role="alert" className="space-y-4 rounded-[22px] bg-[#fdfdfb] p-6 text-[#1e2b1b] shadow-[0_10px_24px_-10px_rgba(30,43,27,0.25),0_0_0_1px_rgba(30,43,27,0.08)]">
          <p className="text-[15px] font-semibold text-red-600">Couldn&apos;t load your wins.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="cursor-pointer inline-flex min-h-11 items-center rounded-full border border-[#5e6b5a]/60 bg-[#e9f0e2] px-[18px] text-[15px] font-semibold text-[#2b4a27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4a27]"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "success" && state.wins.length === 0 && (
        <div className="space-y-5 rounded-[22px] bg-[#fdfdfb] p-6 text-[#1e2b1b] shadow-[0_10px_24px_-10px_rgba(30,43,27,0.25),0_0_0_1px_rgba(30,43,27,0.08)] p-8 text-center">
          <p className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em]">No wins yet</p>
          <a
            href={logWinHref}
            className="inline-flex min-h-12 items-center rounded-full bg-[#2b4a27] px-6 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4a27]"
          >
            Log your first win
          </a>
        </div>
      )}

      {state.status === "success" && state.wins.length > 0 && (
        <ul className="space-y-3">
          {state.wins.map((win) => (
            <li key={win.id} className="space-y-3 rounded-[22px] bg-[#fdfdfb] p-6 text-[#1e2b1b] shadow-[0_10px_24px_-10px_rgba(30,43,27,0.25),0_0_0_1px_rgba(30,43,27,0.08)]">
              {win.photoUrl && (
                <img src={win.photoUrl} alt="" className="max-h-64 w-full rounded-[14px] object-cover" />
              )}
              <p className="text-[17px] leading-7">{win.reflection}</p>
              <p className="flex items-center gap-3 text-[13px] text-[#556251]">
                <span className="rounded-full bg-[#e9f0e2] px-3 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-[#2b4a27]">
                  {CATEGORY_LABELS[win.category] ?? win.category}
                </span>
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
