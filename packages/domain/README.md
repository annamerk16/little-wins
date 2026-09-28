# @project/domain — web-only domain logic

Zod validation schemas and database queries. Used only by the web app — the
worker has no reason to validate user input or run web-queries.

## Public API

`src/index.ts` exports `categorySchema`, `WinCategory`, and `listWins` for
listing a user's wins with an optional category filter.

## Dependencies

- `@project/db` — the Prisma client (for queries)
- `zod` — validation schemas

## Consumers

- `apps/web` — via `@project/domain`

## Why web-only

The worker gets its data from queue messages and writes results via Prisma
directly. It doesn't need Zod validation (the web app already validated) or
the higher-level query API (it does its own specific reads and writes).
Keeping these in a web-only package makes the boundary explicit — the worker
literally cannot import `@project/domain` — and prevents accidental coupling.
