---
type: feature
---
# Create win

## Why

Let users log a win with a reflection, a category, and where it happened.

## Where it lives

- `apps/web/app/api/wins/route.ts` — HTTP handler (`POST`).
- `packages/domain/src/index.ts` — `CreateWin` validation and the user-scoped `createWin` query.
- `packages/domain/tests/win-schema.test.ts` — schema contract tests.

## Behavior

`POST /api/wins` validates the JSON body, creates a win owned by the current user, and returns `{ win }` with status 201.
The client may only send `reflection`, `category`, `latitude`, `longitude`, and an optional `photoUrl`. `id`, `userId`, and timestamps are set by the server.
Errors use `{ error: { code, message } }`.
Authenticated writes require a matching Origin header; rejected origins get
403 `BAD_ORIGIN`. Auth storage/configuration unavailability gets 503
`AUTH_UNAVAILABLE`; other unexpected database failures retain the shared 500.

## Endpoint

| Path | Method | Input schema | Error codes | Scoped by |
|---|---|---|---|---|
| `/api/wins` | POST | `CreateWin`: `reflection` (1–500 chars, trimmed), `category` (`FITNESS`, `ACADEMIC`, `CAREER`, `PERSONAL`), `latitude` (number), `longitude` (number), `photoUrl` (optional URL) | 400 `BAD_JSON`, 400 `VALIDATION`, 401 `UNAUTHENTICATED`, 500 `INTERNAL_ERROR` | `userId` from `currentUserId()` |

## Examples

| Request or condition | Result |
|---|---|
| Valid body | 201, `{ win }` owned by the current user |
| Body is not valid JSON | 400, `BAD_JSON` |
| Missing or invalid field (for example `{}`) | 400, `VALIDATION` |
| No resolved user ID | 401, `UNAUTHENTICATED` |
| Database failure (including a user that does not exist) | 500, `INTERNAL_ERROR`; details logged on the server |

## Verify

Run `pnpm test` and `pnpm test:integration`. With the local app running, sign
in, send a valid POST, a `{}` body, and a non-JSON body using its session
cookie, and confirm another signed-in user's cookie does not reveal the new
win. Include the matching Origin header for CLI writes. Without a valid
cookie, all of those requests return structured 401.

## Constraints & decisions

The [auth subsystem](../auth.md) supplies a verified session user. New wins
belong to that user; no demo-user fallback or client-supplied identity exists.

## Out of scope

Photo upload (a separate endpoint), editing, deleting, and session authentication.
