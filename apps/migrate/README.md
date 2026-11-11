# @project/migrate — the migration CLI and seed script

One-shot tools for managing the database schema and seed data. CI uses these
against a Postgres service container; local dev rarely needs them because the
db-server auto-applies migrations on boot.

## What it does

| Script | Command | Purpose |
|---|---|---|
| `src/index.ts` | `pnpm db:migrate` | Apply pending migrations over the wire |
| `src/seed.ts` | `pnpm db:seed` | Seed the demo user and four category sample wins |

## Dependencies

- `@project/db` — `applyMigrations` for running SQL migration files
- `pg` — the PostgreSQL client driver

## Consumers

Developers and CI. No code imports from `@project/migrate`.

## Local dev

```bash
pnpm db:migrate      # apply pending migrations
pnpm db:seed         # seed demo data (safe to re-run — upserts)
```

Requires the database server running (start it with `pnpm dev` or `pnpm db:dev`).

## The seed data

The seed transaction creates `demo-user` and one synthetic win in each category.
Stable IDs and empty upsert updates preserve existing rows, including user edits;
unrelated users and wins are untouched. Re-running creates only missing sample
rows. `src/seed-data.ts` defines the samples; the CLI disconnects on completion
or failure. See [the home spec](../../docs/specs/wins/home.md).
