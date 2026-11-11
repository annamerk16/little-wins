# ADR-0012: Password and GitHub authentication with database sessions

## Status

Accepted. Supersedes ADR-0003's development identity stub and
replaces the Auth.js/GitHub-only target in `docs/specs/auth.md`.
ADR-0003 remains unchanged as the record of the previous decision.

## Context

Little Wins requires email/password registration and login, GitHub login,
session persistence across refresh, immediate current-session revocation,
and no automatic account linking by matching email. The existing auth
infrastructure specification instead names Auth.js v5, Prisma, database
sessions, and GitHub only. No authentication library is installed yet.

Auth.js documents `UnsupportedStrategy` when Credentials is used without
JWT sessions. Adding Credentials to the planned database-session setup is
therefore unsupported. Changing to JWTs would change the storage/revocation
contract; disguising a database token as a JWT or manually manufacturing
Auth.js sessions would be an unsupported workaround.

## Decision

Use Better Auth and its official Prisma adapter with the existing Prisma 6
client, password authentication, GitHub, and server-side database sessions.
This changes the planned library while preserving database-backed identity.
There is no second session system, JWT session strategy, or auth bypass.

New runtime dependencies are `better-auth` and its supported
`@better-auth/prisma-adapter`, both pinned to 1.7.19 to satisfy the existing
minimum-release-age policy. Their built-in password hashing avoids another
hashing dependency. No package policy exemptions are introduced.

Disable account linking explicitly; a matching email never transfers
ownership or adds a credential. Disable signup auto-login so duplicate
registration can return an indistinguishable success response without
issuing a session. Password email ownership remains unverified in this
initial scope; it cannot authorize linking or recovery.

Use seven-day absolute sessions with refresh disabled and no cookie session
cache. Successful logout uses the documented current-session revocation API
before cookie clearing. Upstream's ordinary sign-out implementation catches
database deletion failures, so it alone cannot establish strict revocation:
revocation failure must return a retryable error, with no successful logout
claim and no prematurely cleared cookie. Same-origin checks precede this
sequence; server API calls must not bypass request security checks.

Use the library's database-backed limiter in development and production.
With no configured trusted proxy, clients share the documented endpoint
bucket rather than trusting spoofable forwarded addresses. This conservative
default can temporarily throttle unrelated users and is an explicit initial
tradeoff; deployment-specific proxy configuration is separate work.

Auth-library account/session/limiter persistence lives in `packages/auth`
through the adapter. Pre-authentication lookup by normalized email, provider
identity, or verified session token is necessary to establish identity;
these auth-only lookups are the narrow exception to user-scoped application
queries. All wins queries stay scoped by the resulting session user.
Application input schemas stay in `packages/domain`, consumed by web only.

## Alternatives considered

- Keep Auth.js plus database sessions: incompatible with password Credentials.
- Auth.js plus JWT sessions: supported for Credentials, but changes the
  required storage model and needs an additional revocation design; not selected.
- Custom credential sessions alongside Auth.js OAuth sessions: duplicates
  authentication and security behavior; not selected.
- Build password/OAuth/session cryptography directly: unnecessary and outside
  the requested scope.

## Consequences

- An additive migration extends User and creates the adapter's required auth
  and limiter tables. Existing User IDs, emails, names, and Win ownership stay
  unchanged. Legacy rows receive no fabricated password or linked account.
- A user whose existing row has no verified login method cannot claim that
  row or its wins by registering with the same email. Recovery/migration of
  such accounts requires separate reviewed ownership proof.
- `/` and existing sandbox pages are private because they expose user context;
  `/login`, `/register`, health, and required auth endpoints are public.
  No new landing page or product-screen integration is added.
- The identity seam uses the same real auth in development and production,
  replacing its zero-setup stub exception. A signing secret, canonical URL,
  and GitHub OAuth configuration are documented; there is no dev identity flag.
- Runtime support is verified against the exact installed version with real
  library/adapter integration tests before the implementation is considered ready.

## Sources

- [Auth.js UnsupportedStrategy](https://authjs.dev/reference/core/errors#unsupportedstrategy).
- [Better Auth password support, hashing, and duplicate-response configuration](https://better-auth.com/docs/authentication/email-password).
- [GitHub provider](https://better-auth.com/docs/authentication/github),
  [Prisma compatibility](https://better-auth.com/docs/adapters/prisma), and
  [session management](https://better-auth.com/docs/concepts/session-management).
- [Account linking controls](https://better-auth.com/docs/concepts/users-accounts#account-linking)
  and [rate-limit configuration](https://better-auth.com/docs/concepts/rate-limit).
- Upstream [sign-out implementation](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/routes/sign-out.ts)
  and [revocation implementation](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/routes/session.ts).
