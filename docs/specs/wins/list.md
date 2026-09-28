---
type: feature
---
# List wins

## Why

Let users review their wins, optionally by category.

## Where it lives

- `apps/web/app/api/wins/route.ts` — HTTP handler.
- `packages/domain/src/index.ts` — validation and user-scoped query.

## Behavior

`GET /api/wins` returns `{ wins }`, newest first, for the current user only.
Optional `category` must be `FITNESS`, `ACADEMIC`, `CAREER`, or `PERSONAL`.
Errors use `{ error: { code, message } }`.

## Examples

| Request or condition | Result |
|---|---|
| No category | 200, all of the user's wins |
| `?category=CAREER` | 200, only their career wins |
| Empty or invalid category | 400, `BAD_CATEGORY` |
| No resolved user ID | 401, `UNAUTHENTICATED` |
| Auth or database failure | 500, `INTERNAL_ERROR`; details logged on the server |

## Verify

Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.
Check the cases above against the handler, including exclusion of other users' wins.

## Constraints & decisions

The [dev auth stub](../auth.md) defaults to the demo user when no identity is supplied.

## Out of scope

Pagination, writes, and session authentication.
