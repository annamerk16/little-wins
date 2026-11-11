# The local Little Wins app is not running

**Use when:** starting the shared app or diagnosing local startup and seed failures.
**Last drilled:** Windows command-line startup, repeated seed, edit preservation,
API ownership, stopped-database errors, and recovery verified. Browser keyboard
and geolocation checks remain pending because browser control is unavailable.

## Before you start

- Open a terminal in the repository root with Node and the repository's pnpm version available.
- Use `pnpm.cmd` instead of `pnpm` in PowerShell if its execution policy blocks `pnpm.ps1`; do not change system policy.
- Keep ports 3000, 5433, and 10000–10002 available. Stop a previous development session with Ctrl+C before starting another.
- These steps use local development data. They do not reset data or require Docker or Azure credentials.

## Steps

1. Run `pnpm install`, then `pnpm prisma:generate`.
2. Run `pnpm dev` and leave that terminal running. Wait for Next.js to report Ready, Postgres to report `postgres ready`, and Azurite to report its listening ports. Turbo starts only web, worker, and db-server; migration and seed commands are one-shot tools.
3. Open `http://localhost:3000/api/health`. Confirm `{"status":"ok","db":"ok"}`.
4. In a second terminal at the repository root, run `pnpm db:seed`. Confirm its success message and that it exits.
5. Open `http://localhost:3000/`. Confirm the heading Little Wins, category filter, Log a win action, and timeline.
6. Run `pnpm db:seed` again. Confirm sample rows are not duplicated and edited existing sample rows are preserved.
7. Run `pnpm test`, `pnpm typecheck`, and `pnpm build` after stopping the development session; build and development share the `.next` output directory. Build downloads the configured Google fonts and requires network access.

## Verify it worked

- `/api/health` is healthy, each category has its synthetic sample win, and All shows them together.
- Creating a win refreshes the active category. Cancelled deletion keeps the row; confirmed deletion removes it. Repeat seed only if you want deleted sample rows recreated.
- Tests include both workspace package tests and the root integration/UI logic suite.

## If this didn't work

- If the database is unreachable, inspect the dev terminal for the first database error; for isolated diagnostics run `pnpm db:dev` and `pnpm dev:web` in separate terminals.
- If ports are occupied, stop the known previous session. Do not kill unrelated processes or reset the database.
- If seeding fails, check database readiness and the error. Do not delete `.pgdata`, edit `.env`, or reset data as a workaround.
- If a build cannot fetch Google fonts, restore network access and retry.

## Related

- [Connected home screen](../specs/wins/home.md)
- [Health and web standards](../specs/web.md)
