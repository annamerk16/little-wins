# Authentication and verified identity

Better Auth 1.7.19 and its matching official Prisma adapter implement email/
password and GitHub login with database sessions. Password hashes use the
library's salted scrypt implementation. Account linking is explicitly disabled.

`currentUserId(request?)` returns a verified session's User ID or null.
`requireUserId(returnTo?)` redirects signed-out page requests to login.
There is no header/env/demo identity fallback. `server` exposes the lazy auth
instance and configuration; `http` enforces the public endpoint allowlist,
origin checks, JSON error mapping, and revocation-before-cookie-clearing.
Browser forms use same-origin HTTP calls and never import the Prisma/auth
server graph. The `#database` import maps to the existing database workspace
name, so source code does not hardcode the placeholder scope.
TypeScript source paths resolve these mappings for Next.js 15 Turbopack;
package imports retain workspace resolution for Node and the test runner.

The User is shared with wins; Session, Account, Verification, and RateLimit
are library-owned auth tables. Auth-only identity lookups precede user-scoped
application queries. Dependencies are the existing Next/database workspace,
Better Auth, and its adapter; the worker does not consume browser identity.

Sessions use HttpOnly/SameSite=Lax cookies, Secure over HTTPS, and seven-day
absolute expiry. Every protected operation checks database-backed identity;
cookie session caching and sliding renewal are disabled. Logout awaits the
supported revocation API before clearing cookies; database failure stays a
retryable error. Other sessions remain valid.

Configuration: `BETTER_AUTH_SECRET` (at least 32 random bytes),
`BETTER_AUTH_URL` (canonical origin; HTTPS in production), and optional
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` to enable GitHub. No secret has a
committed default, and configuration is validated lazily so health/build
do not require OAuth credentials. Missing core settings fail closed.

The limiter is enabled in all environments with database storage and no
trusted client-IP headers. Clients therefore share an endpoint bucket:
five login requests/minute and three registrations/minute. Proxy-specific
configuration is separate work. Signup does not automatically sign in and
returns generic completion for duplicates. Legacy users receive no invented
password or linked identity, and new accounts cannot claim their wins.

See [setup and OAuth instructions](../../docs/runbooks/authentication-setup.md),
[the feature spec](../../docs/specs/authentication/sign-in.md), and
[ADR-0012](../../docs/adr/0012-password-github-database-sessions.md).

Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.
The root suite exercises real library sessions, Prisma/PGlite storage,
cross-user authorization, revocation failure/retry, limiter concurrency,
transaction rollback, schema preservation, and mocked GitHub protocol
boundaries. Provider fixtures do not prove live GitHub credentials or browser
behavior. Recovery, verification email, linking, profiles, and extra providers
are explicitly deferred.
