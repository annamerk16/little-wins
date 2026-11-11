---
type: infrastructure
---
# Seams — the unifying pattern

The same shape appears across every cloud dependency in this project:

```
local dev:  a stand-in (emulator, stub, env flag)
production: the real thing (Azure, real auth, etc.)
```

The stand-in is the default. Production is a single environment variable away.
This is called the **seam pattern** — a deliberate cut point where local and
production behavior diverge, controlled by configuration, not code branches.

## Instances

| Subsystem | Local stand-in | Production | Env var / switch |
|---|---|---|---|
| Database (tests) | PGlite (in-memory) | — | `PGLITE_DATA_DIR` flag |
| Database (dev) | Local Postgres via `apps/db-server/` | Azure Postgres | `DATABASE_URL` |
| Blob storage | Azurite | Azure Blob Storage | `AZURE_STORAGE_CONNECTION_STRING` |
| Queue | Azurite | Azure Storage Queue | `AZURE_STORAGE_CONNECTION_STRING` |
| Identity | Real password/GitHub auth with database sessions | Same auth with production secrets and HTTPS | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, optional GitHub credentials; see [auth](auth.md) |

## Design intent

- **No code branches.** The seam is never an `if (isLocal)`. The stand-in and
  the real thing implement the same interface, and the configuration chooses
  which one the SDK connects to.
- **Default to running.** Infrastructure stand-ins need no cloud account.
  `pnpm dev` starts Postgres and Azurite. Real authentication has the explicit
  configuration exception below.
- **Safe by default.** Missing authentication configuration fails closed;
  development cannot make a client-supplied identity trustworthy.
- **One env var per seam.** Azure Blob and Queue share
  `AZURE_STORAGE_CONNECTION_STRING`; the database has its own
  (`DATABASE_URL`). Infrastructure seams use one switch each; identity has
  the explicit exception below.

The identity subsystem is the explicit exception to the zero-setup stub and
single-variable rule: it uses real sessions in every environment and needs a
secret, canonical URL, and provider credentials. There is no environment flag
that makes a client-supplied identity trustworthy. See
[ADR-0012](../adr/0012-password-github-database-sessions.md).

## ADRs

- [ADR-0005](../adr/0005-pglite-tests.md) — PGlite as the test-database seam.
- [ADR-0008](../adr/0008-azurite-seam.md) — Azurite as the blob/queue seam.
- [ADR-0003](../adr/0003-dev-identity-stub.md) — the identity stub as the auth
  seam's historical implementation.
- [ADR-0012](../adr/0012-password-github-database-sessions.md) — real
  authentication in every environment.

## Adding a new seam

1. Write the stand-in (emulator, stub, env guard).
2. Default to the stand-in.
3. Require one env var to swap to production.
4. Add a health check or probe that tells the user if the stand-in is down.
5. Write an ADR capturing the decision.
6. Add a row to this table.
