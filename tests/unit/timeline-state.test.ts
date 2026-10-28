import { describe, expect, it } from "vitest";
import {
  begin,
  cancel,
  fail,
  initialTimelineState,
  succeed,
  type TimelineWin,
} from "../../apps/web/components/timeline-state";

const win: TimelineWin = {
  id: "w1",
  reflection: "Ran 5k",
  category: "FITNESS",
  photoUrl: null,
  createdAt: "2026-10-01T12:00:00.000Z",
};

describe("timeline state", () => {
  it("begins loading from idle with a new request id", () => {
    expect(begin(initialTimelineState)).toEqual({ status: "loading", requestId: 1 });
  });

  it("ignores begin while a request is in flight (double-click)", () => {
    const loading = begin(initialTimelineState);
    expect(begin(loading)).toBe(loading);
  });

  it("moves loading to success with the returned wins", () => {
    const loading = begin(initialTimelineState);
    expect(succeed(loading, loading.requestId, [win])).toEqual({
      status: "success",
      requestId: 1,
      wins: [win],
    });
  });

  it("keeps an empty list as success, not error", () => {
    const loading = begin(initialTimelineState);
    expect(succeed(loading, loading.requestId, [])).toMatchObject({ status: "success", wins: [] });
  });

  it("moves loading to error on failure", () => {
    const loading = begin(initialTimelineState);
    expect(fail(loading, loading.requestId)).toEqual({ status: "error", requestId: 1 });
  });

  it("retries from error with a fresh request id", () => {
    const errored = fail(begin(initialTimelineState), 1);
    expect(begin(errored)).toEqual({ status: "loading", requestId: 2 });
  });

  it("ignores a response from a superseded request", () => {
    const retried = begin(fail(begin(initialTimelineState), 1));
    expect(succeed(retried, 1, [win])).toBe(retried);
    expect(fail(retried, 1)).toBe(retried);
  });

  it("ignores a response once the request is cancelled", () => {
    const loading = begin(initialTimelineState);
    const cancelled = cancel(loading);
    expect(cancelled.status).toBe("idle");
    expect(succeed(cancelled, loading.requestId, [win])).toBe(cancelled);
    expect(fail(cancelled, loading.requestId)).toBe(cancelled);
  });

  it("allows a new request after cancel (remount)", () => {
    const cancelled = cancel(begin(initialTimelineState));
    const restarted = begin(cancelled);
    expect(restarted).toMatchObject({ status: "loading" });
    expect(restarted.requestId).toBeGreaterThan(1);
  });

  it("cancel is a no-op outside loading", () => {
    const done = succeed(begin(initialTimelineState), 1, [win]);
    expect(cancel(done)).toBe(done);
  });
});
