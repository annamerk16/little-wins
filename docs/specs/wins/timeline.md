---
type: feature
---
# The timeline shows the current user's wins with honest loading, empty, and error states

## Why
Users scroll back through their wins, newest first, to see progress over
time. The screen never pretends: while data is loading it says so, when there
is nothing it offers a next step, and when the server fails it says so and
lets the user try again.

## Where it lives
- `apps/web/components/Timeline.tsx` — client component; renders the list
  and its three async states.
- `apps/web/components/timeline-state.ts` — pure state transitions for the
  fetch lifecycle (no React).
- `tests/unit/timeline-state.test.ts` — transition tests.
- `apps/web/app/sandbox/timeline/page.tsx` — sandbox route that mounts the
  component. The homepage composes it through `WinsHome.tsx`; see [home.md](home.md).
- Existing `GET /api/wins`; see [list.md](list.md).

## Behavior
- On mount the timeline requests `GET /api/wins`, adding `?category=CATEGORY`
  when its `category` prop is set. Changing category or `refreshKey` cancels
  and replaces the pending request. Strict Mode can start a replacement
  after cleanup; cancelled responses never populate the list.
- **Loading:** a skeleton of three placeholder cards renders in place of the
  list, and the region has `aria-busy="true"` with a status message
  "Loading wins…". No full-page spinner.
- **Success:** each win renders as a card in the order the API returns
  (newest first) with its reflection, category label, and created date
  formatted in the viewer's locale. A photo renders when `photoUrl` is set,
  with empty `alt` (decorative; the reflection carries the meaning).
- **Empty:** when the API returns no wins, the region shows "No wins yet"
  and a primary action, "Log your first win", linking to the Log a Win form
  (`onLogWin` callback on the home screen, or `logWinHref`, default
  `/sandbox/log-win`, for standalone demos). A filtered empty result says
  "No wins in this category yet."
- **Error:** when the request fails (network error or any non-2xx), the
  region shows an error card with role `alert`, the message "Couldn't load
  your wins.", and a Retry button. The raw error is never shown. Retry
  refetches.
- **Double-click safety:** at most one request is in flight. Clicking Retry
  replaces the error card with the skeleton, and any retry while a request is
  pending is ignored, so rapid clicks produce exactly one request. A response from a superseded
  or unmounted request never changes the screen.
- **Creation:** a successful creation increments `refreshKey`; the active
  category is retained and refetched.
- **Deletion:** each card opens the shared confirmation dialog. Confirm
  removes the card optimistically; failure restores it at its original
  sorted position, shows an alert, and leaves the dialog available for retry.
  Pending and successful deletions are excluded from overlapping GET
  results. Success announces deletion and refreshes the active category.
  The dialog stays mounted independently of the removed card. Closing it
  focuses the original trigger if it still exists, otherwise the timeline
  heading. See [delete.md](delete.md) and [home.md](home.md).

## Examples
| State / input | Behavior |
|---|---|
| Response delayed 3 s | Skeleton and "Loading wins…" for 3 s, then cards |
| API returns 2 wins | Two cards, newest first, with reflection, category, date |
| API returns `{ wins: [] }` | "No wins yet" with a link to log a win |
| API returns 500 `INTERNAL_ERROR` | Error card with Retry; no code or stack shown |
| Network unreachable | Same error card with Retry |
| Retry clicked 5 times quickly after an error | Exactly one new request; skeleton until it settles |
| Retry succeeds | Error card replaced by cards (or empty state) |

## Verify
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass; unit tests cover
  every transition in `timeline-state.ts`, including ignored duplicate
  retries and stale responses.
- With `pnpm dev` running and the `demo-user` row seeded, open
  `/sandbox/timeline` and run the three proofs:
  1. **Slow network:** DevTools → Network → "Slow 3G", reload: the skeleton
     is visible before the cards.
  2. **Server down:** stop the dev database and reload: the error card
     appears; restart it and click Retry: the cards return.
  3. **Double-click:** with the database stopped, double-click Retry and
     check the Network panel: one request per settled retry.
- Keyboard-only: Tab reaches Retry and the empty-state link; Enter activates
  them.

## Constraints & decisions
- Client-side fetch against the existing API instead of a Server Component,
  so the three states and the proofs can be observed in the browser. No API
  or schema changes.
- Duplicate-request protection lives in the state machine, read through a
  ref, so it holds even if the button is clicked again before React
  re-renders.
- No new dependencies. Component tests would need jsdom and Testing
  Library; the logic is tested through the pure state module instead.
- No pagination: the API returns all of the user's wins (see
  [list.md](list.md)).

## Out of scope
- Form validation and creation requests — [create.md](create.md).
- Server deletion semantics — [delete.md](delete.md).
- Screen composition and local setup — [home.md](home.md).
