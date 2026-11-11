// Pure fetch-lifecycle transitions for the timeline (docs/specs/wins/timeline.md).
// Every transition returns the same object when it is ignored, so callers can
// tell "nothing happened" by identity — that is how duplicate retries and
// stale responses are dropped.

export type TimelineWin = {
  id: string;
  reflection: string;
  category: string;
  photoUrl: string | null;
  createdAt: string;
};

export type TimelineState =
  | { status: "idle"; requestId: number }
  | { status: "loading"; requestId: number }
  | { status: "success"; requestId: number; wins: TimelineWin[] }
  | { status: "error"; requestId: number; message?: string };

export const initialTimelineState: TimelineState = { status: "idle", requestId: 0 };

// Retry ignores a duplicate; selection changes and mutations can supersede it.
export function begin(state: TimelineState, supersede = false): TimelineState {
  if (state.status === "loading" && !supersede) return state;
  return { status: "loading", requestId: state.requestId + 1 };
}

export function succeed(
  state: TimelineState,
  requestId: number,
  wins: TimelineWin[],
): TimelineState {
  if (state.status !== "loading" || state.requestId !== requestId) return state;
  return { status: "success", requestId, wins };
}

export function fail(state: TimelineState, requestId: number, message?: string): TimelineState {
  if (state.status !== "loading" || state.requestId !== requestId) return state;
  return { status: "error", requestId, ...(message ? { message } : {}) };
}

// Abandons the in-flight request (e.g. on unmount); its late response is ignored.
export function cancel(state: TimelineState): TimelineState {
  if (state.status !== "loading") return state;
  return { status: "idle", requestId: state.requestId + 1 };
}

// Pending and successful deletes stay hidden even if an older GET includes them.
export function visibleWins(wins: TimelineWin[], hiddenIds: ReadonlySet<string>) {
  return wins.filter((win) => !hiddenIds.has(win.id));
}

export function removeWin(state: TimelineState, id: string): TimelineState {
  if (state.status !== "success") return state;
  return { ...state, wins: state.wins.filter((win) => win.id !== id) };
}

export function restoreWin(state: TimelineState, win: TimelineWin, category: string, index?: number): TimelineState {
  if (state.status !== "success" || (category && win.category !== category)) return state;
  if (state.wins.some((row) => row.id === win.id)) return state;
  const wins = [...state.wins];
  wins.splice(index ?? wins.length, 0, win);
  return { ...state, wins: wins.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}
