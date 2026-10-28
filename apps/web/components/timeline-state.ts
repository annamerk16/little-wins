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
  | { status: "error"; requestId: number };

export const initialTimelineState: TimelineState = { status: "idle", requestId: 0 };

// Starts a request unless one is already in flight.
export function begin(state: TimelineState): TimelineState {
  if (state.status === "loading") return state;
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

export function fail(state: TimelineState, requestId: number): TimelineState {
  if (state.status !== "loading" || state.requestId !== requestId) return state;
  return { status: "error", requestId };
}

// Abandons the in-flight request (e.g. on unmount); its late response is ignored.
export function cancel(state: TimelineState): TimelineState {
  if (state.status !== "loading") return state;
  return { status: "idle", requestId: state.requestId + 1 };
}
