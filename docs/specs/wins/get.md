---
type: feature
---
# Get a win by id

## Why

Let users open a single win's detail — the map pin or list item they tapped —
without refetching or filtering the full list.

## Where it lives

- `apps/web/app/api/wins/[id]/route.ts` — HTTP handler.
- `packages/domain/src/index.ts` — user-scoped query (`getWin`).

## Behavior

`GET /api/wins/:id` returns `{ win }` for the current user's win with that id.
A win that doesn't exist, or belongs to another user, returns 404 — the two
cases are indistinguishable to the caller (see [web.md](../web.md)).
Errors use `{ error: { code, message } }`.

## Examples

| Request or condition | Result |
|---|---|
| id belongs to the current user | 200, `{ win }` |
| id doesn't exist | 404, `NOT_FOUND` |
| id belongs to another user | 404, `NOT_FOUND` |
| No resolved user ID | 401, `UNAUTHENTICATED` |
| Auth or database failure | 500, `INTERNAL_ERROR`; details logged on the server |

## Verify

Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.
Check the cases above against the handler, including that another user's win
404s rather than 403s.

## Constraints & decisions

The [dev auth stub](../auth.md) defaults to the demo user when no identity is
supplied. Foreign and absent ids are deliberately indistinguishable, per
[web.md](../web.md).

## Out of scope

Editing and photo upload for a single win are not yet specified. Deletion is
specified in [delete.md](delete.md).
