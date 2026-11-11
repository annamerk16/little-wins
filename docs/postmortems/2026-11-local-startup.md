# Windows startup failed and the documented seed command was missing

**Reported:** local category-filter walkthrough. **Spec:** `docs/specs/wins/home.md`.

## Report

Running `pnpm dev` on Windows printed a Turbo error that no package named
`'!@project/migrate'` existed. Azurite stayed running while web and Postgres
never started. `pnpm db:seed` then failed because no root script existed.

## Expected vs actual

The repository instructions described a working local stack and demo seed.
In practice, the shell passed literal single quotes into Turbo's filter,
the root seed alias was absent, and the underlying seed file was a no-op.

## Root cause

The startup command depended on POSIX single-quote stripping inside an
embedded command executed by the Windows shell. The seed documentation
survived the starter template without a corresponding implementation.

## The fix

Use explicit path filters without nested shell quotes and stop sibling
processes when a service exits. Add a root seed command and a transactional,
repeatable seed for the demo user and four sample wins.

## Why our defenses missed it

Automated tests did not execute the Windows startup path or the seed CLI.
The default test command also skipped the root integration suite.

## What changed beyond the fix

The home spec and local-development runbook define the startup and seed
drill. Seed integration tests prove repeatability, edit preservation, and
rollback on failure. `pnpm test` includes the root suite, so CI exercises it.
