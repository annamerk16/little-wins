---
type: feature
---
# Delete a win

## Why

Let users remove a win they no longer want while preventing them from learning
about or changing another user's data.

## Where it lives

- `apps/web/app/api/wins/[id]/route.ts` — HTTP handler.
- `packages/domain/src/index.ts` — owner-scoped deletion (`deleteWin`).
- `tests/integration/wins-delete.test.ts` — database behavior and ownership tests.
- `tests/integration/wins-delete-route.test.ts` — HTTP response and error tests.

## Behavior

`DELETE /api/wins/:id` derives the current user with the existing authentication
helper and deletes the matching win only when that user owns it. The request does
not accept a user id in its body, query string, or route parameters.

A successful deletion permanently removes the `Win` row and returns `204 No
Content` with an empty response body. The deletion is hard rather than soft
because the `Win` model has no `deletedAt` field.

If the id is unknown or belongs to another user, the endpoint returns 404 with
`{ error: { code: "NOT_FOUND", message: "Win not found" } }`; callers cannot
distinguish those cases. An unresolved user returns 401 with the shared error
shape. Unexpected authentication or database failures are logged on the server
and return 500 without exposing the underlying error.

## Examples

| State / input | Behavior |
|---|---|
| The current user owns the requested win | 204, empty body; the row no longer exists |
| The requested win belongs to another user | 404, `NOT_FOUND`; the row remains unchanged |
| The requested id does not exist | 404, `NOT_FOUND` |
| The same deletion is requested a second time | 404, `NOT_FOUND` |
| No user id is resolved | 401, `UNAUTHENTICATED` |
| Authentication or database access fails | 500, `INTERNAL_ERROR`; details are logged only on the server |

## Verify

Run:

```bash
pnpm exec vitest run tests/integration/wins-delete.test.ts tests/integration/wins-delete-route.test.ts
pnpm test
pnpm typecheck
pnpm build
```

With the local app running and a known win owned by `demo-user`, send
`curl.exe -i -X DELETE http://localhost:3000/api/wins/<id> -H "x-user-id: demo-user"`.
Confirm the first request returns 204 with no body, the win disappears from
`GET /api/wins`, and repeating the DELETE returns 404. Send the same request
for a win owned by a different test user and confirm it returns 404 without
deleting that row.

## Constraints & decisions

- One owner-scoped database operation performs the delete and reports whether a
  row matched; this avoids a separate ownership check and a check-then-delete
  race.
- The route treats the win id as an opaque string. Any value that does not match
  an owned row follows the same 404 path.
- Deletion removes only the database row. Removing a resource referenced by
  `photoUrl` is not part of this endpoint because the current Win model does not
  define attachment ownership or cleanup behavior.
- There is no Win history model, so this operation does not create a history
  event or require a schema migration.

## Out of scope

Undo or recovery, bulk deletion, deleting photo storage, editing wins, and user
account deletion are separate behaviors and are not specified here.
