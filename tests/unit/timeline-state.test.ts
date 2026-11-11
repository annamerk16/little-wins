import { describe, expect, it } from "vitest";
import {
  begin,
  cancel,
  fail,
  initialTimelineState,
  succeed,
  removeWin,
  restoreWin,
  visibleWins,
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

  it("a category change or creation refresh supersedes a pending fetch", () => {
    const old = begin(initialTimelineState);
    const refreshed = begin(old, true);
    expect(refreshed.requestId).toBeGreaterThan(old.requestId);
    expect(succeed(refreshed, old.requestId, [win])).toBe(refreshed);
    expect(fail(refreshed, old.requestId)).toBe(refreshed);
    expect(succeed(refreshed, refreshed.requestId, [])).toMatchObject({ status: "success", wins: [] });
  });

  it("removes optimistically and restores a failed deletion in its original position, including tied dates", () => {
    const newer = { ...win, id: "newer", createdAt: "2026-10-02T12:00:00.000Z" };
    const tied = { ...win, id: "tied" };
    const done = succeed(begin(initialTimelineState), 1, [newer, win, tied]);
    const removed = removeWin(done, win.id);
    expect(removed).toMatchObject({ wins: [newer, tied] });
    const restored = restoreWin(removed, win, "FITNESS", 1);
    expect(restored).toMatchObject({ wins: [newer, win, tied] });
    expect(restoreWin(restored, win, "FITNESS", 1)).toBe(restored);
  });

  it("never restores a failed deletion into a different category", () => {
    const career = { ...win, id: "career", category: "CAREER" };
    const done = succeed(begin(initialTimelineState), 1, [career]);
    expect(restoreWin(done, win, "CAREER")).toBe(done);
    expect(restoreWin(done, win, "")).toMatchObject({ wins: [career, win] });
  });

  it("filters pending and confirmed deletions from responses that started before the mutation", () => {
    const another = { ...win, id: "another" };
    const hidden = new Set([win.id]);
    expect(visibleWins([win, another], hidden)).toEqual([another]);
    hidden.delete(win.id); // failed delete; the next response can include the restored row
    expect(visibleWins([win, another], hidden)).toEqual([win, another]);
  });
});
