# Little Wins

Track small achievements, filter them by category, and review your progress.
The home screen connects the team's timeline, category filter, creation form,
and delete confirmation dialog.

## Run locally

Use Node and pnpm (the version is pinned in `package.json`). No Docker or cloud
account is needed. From the repository root:

```powershell
pnpm install
pnpm prisma:generate
pnpm dev
```

Leave that terminal running. When Postgres reports `postgres ready`, open a
second terminal in the same folder:

```powershell
pnpm db:seed
```

Open **http://localhost:3000/**. Check **http://localhost:3000/api/health** for
`{"status":"ok","db":"ok"}`. In PowerShell, use `pnpm.cmd` in place of `pnpm`
if script execution policy blocks the `.ps1` launcher.

The seed creates `demo-user` and four synthetic sample wins, one per category.
Repeated runs preserve existing rows and edits; missing sample rows are recreated.
The default dev identity is `demo-user`. Creating a win requires explicitly
sharing location with the local site; photo upload is separate work.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Web, worker, embedded Postgres, and Azurite |
| `pnpm db:seed` | Repeatable demo user and category sample wins |
| `pnpm test` | Workspace tests plus root integration and UI logic tests; no running services |
| `pnpm typecheck` | Typecheck all packages and apps |
| `pnpm build` | Production build; network access is needed to download Google fonts |
| `pnpm db:dev` | Postgres only |
| `pnpm dev:web` | Web only |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm prisma:generate` | Generate the typed database client |

Stop development before building; both use `apps/web/.next`.

Standalone component demos remain at `/sandbox/category-filter`,
`/sandbox/timeline`, `/sandbox/delete-confirm`, and `/sandbox/log-win`.

## Project layout

`apps/` contains web, worker, database host, and migration/seed processes.
`packages/` contains shared database, domain, auth, services, and logging libraries.
The web app uses Next.js and React, data uses Prisma and Postgres, and tests use
Vitest with in-memory PGlite.

Read [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[the home spec](docs/specs/wins/home.md), and
[the local-development runbook](docs/runbooks/local-development.md).

## Sync team changes

Commit or stash your work before switching branches. To update local main:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
```

Feature branches stay separate until reviewed and merged through a pull request.
Never commit local database/storage directories, dependencies, build output, or
`.env` files. Read agent-generated changes before merging.
