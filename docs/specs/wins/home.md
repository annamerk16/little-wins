---
type: feature
---
# The home screen connects the team's wins features

## Why
Users review, filter, create, and delete their wins from one screen instead
of navigating separate component demos. Contributors can start the app and
load repeatable sample data on Windows as well as other supported platforms.

## Where it lives
- `apps/web/app/page.tsx` — the wins home screen at `/`.
- `apps/web/components/WinsHome.tsx` — screen composition and selected category.
- `apps/web/components/Timeline.tsx` and `timeline-state.ts` — filtered
  loading, refresh after creation, and deletion with rollback.
- `apps/web/components/CategoryFilter.tsx` — the existing category dropdown.
- `apps/web/components/LogWinDialog.tsx` — the existing creation dialog,
  with a callback after successful creation.
- `apps/web/components/DeleteWinDialog.tsx` — the existing confirmation
  dialog, with unique accessible IDs for each card and pending protection.
- Existing win routes and `packages/domain/src/index.ts` — authoritative
  validation and user-scoped queries; no API or schema changes.
- `package.json` and `apps/migrate/src/seed.ts` — portable startup and
  repeatable local sample data.
- `apps/migrate/src/seed-data.ts` and `tests/integration/seed.test.ts` —
  transactional seed behavior and repeatability checks.
- `README.md` and `docs/runbooks/local-development.md` — local setup and
  checks; related feature specs describe their reusable components.

## Behavior
The home screen shows a Little Wins heading, Log a win action, category
filter, and the current user's timeline. All is selected initially. Existing
sandbox routes continue to work independently.

The timeline requests `/api/wins` for All and
`/api/wins?category=CATEGORY` for a selected category. Loading shows the
existing skeleton, an empty result explains whether there are no wins or no
matches in the selected category, and a failed request offers Retry.
Changing category cancels the previous request; stale responses cannot
replace the current result. An empty timeline lets the user open the
creation dialog without a broken link to an unimplemented page.

Creation uses the existing dialog and `POST /api/wins`. A successful save
announces success and refreshes the currently selected category. A new win
in a different category stays hidden until that category or All is selected.
A failed save preserves the draft and shows the existing retryable error.
Location is requested only when the user presses the location action.

Each card offers the existing delete confirmation. Cancel makes no request.
Confirm sends `DELETE /api/wins/:id` once and removes the card optimistically.
Failure restores it in its original order and shows an accessible error
notification with a way to try again. Success announces deletion. A pending
delete cannot be submitted again or dismissed with Escape; category changes
and overlapping fetches cannot resurrect a successfully deleted card or
insert a rolled-back card into another category's results. A stale response
after a mutation is ignored and the current category is refreshed.

Identity comes from the existing server auth seam; no new client-supplied
user IDs are introduced. Foreign or missing resources continue to return
404, and all API errors retain `{ error: { code, message } }`. A 401 displays
a sign-in message; actual session authentication remains separate work.

`pnpm dev` starts the existing web, worker, database, and Azurite processes
without passing literal shell quotes into Turbo's package filter on Windows.
`pnpm db:seed` exists and, with the database running, transactionally creates
`demo-user` and one sample win in each of the four categories. Stable IDs
make repeated seeding safe: existing rows and user edits are preserved, and
unrelated users and wins are untouched. The script disconnects on completion
or failure. Seeding is an explicit local-development action, never an
automatic write on page load or server startup.

`pnpm test` runs both workspace package tests and the root Vitest suite,
including integration, timeline-state, and log-win validation tests, so the
documented command and CI exercise the same project behavior.

## Examples
| State / input | Behavior |
|---|---|
| Open `/` with seeded data | Four category sample wins appear, newest first |
| Select Fitness | Only Fitness wins appear |
| Switch Fitness to Career before the first request finishes | Only Career results can populate the timeline |
| Save an Academic win while Fitness is selected | Save succeeds; Fitness stays selected and the new win is hidden |
| Switch to All after that save | The new Academic win appears |
| Cancel delete | Card remains and no DELETE is sent |
| Confirm delete twice quickly | One DELETE is sent; the card disappears |
| DELETE fails | Card returns in place and an accessible failure notification appears |
| GET fails, then Retry succeeds | Error card changes to the current category's results |
| Run seed twice | No duplicate sample wins; existing user edits remain intact |
| Open another user's win URL | API returns 404 |

## Verify
- Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- Exercise category changes, stale fetches, mutation refresh, and deletion
  rollback through meaningful state tests; assert real server ownership and
  error behavior through the existing integration suite.
- Follow `docs/runbooks/local-development.md` on Windows: start `pnpm dev`,
  confirm `/api/health` is healthy, seed twice, and confirm one sample per
  category with no duplicates. Preserve edits to one seeded row across a
  subsequent seed invocation.
- At `/`, filter each category, create a win after explicitly granting
  location access, confirm its appearance under All and its category, then
  cancel and confirm deletion on separate attempts.
- Keyboard only: reach the filter and each action, cycle focus within both
  dialogs, close an idle dialog with Escape, and confirm focus returns to
  its trigger or an appropriate remaining timeline control after deletion.
- With the database stopped, verify initial load and save errors, retained
  form values, deletion rollback, and successful retries after restarting it.
- Throttle requests and change category during a fetch and a mutation;
  confirm stale data never overrides the active selection.

## Constraints & decisions
- Reuse the team's existing components and API contracts so each published
  feature contributes to the shared screen. No new dependencies or database
  migrations are needed.
- Server validation and queries stay in `packages/domain`; browser-safe
  form feedback must not import the Prisma-backed server entry point. See
  [the web contract](../web.md) and [monorepo rules](../monorepo.md).
- Optimistic deletion and visible rollback follow the existing async-honesty
  contract in [web.md](../web.md). Database deletion remains permanent
  because the current Win schema has no `deletedAt`; see [delete.md](delete.md).
- Seed rows use obviously synthetic reflections and coordinates. Seeding
  does not read, edit, reset, or commit `.env`, `.pgdata`, or `.azurite` files.
- Component ownership notes in [timeline.md](timeline.md) and
  [category-filter.md](category-filter.md), plus creation and deletion
  behavior in [create.md](create.md) and [delete.md](delete.md), are updated
  alongside implementation to describe the shared screen.

## Out of scope
Session authentication, photo upload, editing wins, monthly recap,
pagination, deployment, and unpublished work on teammates' computers.
This feature does not automatically merge future team branches.
