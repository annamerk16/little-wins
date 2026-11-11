---
type: infrastructure
---
# Identity is derived from verified database sessions

## Purpose

All private pages and wins APIs identify the current user through a verified
session. Email/password and GitHub share the same auth service and database
session model. The feature contract is [authentication/sign-in.md](authentication/sign-in.md).

## Library and identity boundary

- Better Auth with its supported Prisma adapter owns password verification,
  GitHub OAuth, account resolution, and database sessions. The library change
  from the former Auth.js-only plan follows
  [ADR-0012](../adr/0012-password-github-database-sessions.md).
- `packages/auth/` exposes server-only session helpers and a separate safe
  browser entry point. `currentUserId()` returns a verified User ID or null;
  it never trusts request-supplied user IDs, development flags, or a demo user.
- Authentication-only lookups by email, provider identity, and verified session
  token establish identity. They do not grant ownership by matching email.
  Application queries, including every win operation, remain user-scoped.
- Application input schemas live in `packages/domain`, imported by web only.
  Library-owned auth persistence uses the supported adapter in `packages/auth`;
  it does not turn domain into a shared worker authentication package.
- Runtime code has no development identity bypass. Historical immutable ADRs
  retain their original text; adversarial tests can name obsolete headers to
  prove that those inputs no longer grant access.

## Session and account contract

- Password and GitHub login issue the same server-stored session, with an
  opaque identifier in an HttpOnly cookie, SameSite=Lax and Secure on HTTPS.
- Sessions expire after seven days absolutely; renewal and cookie session-data
  caching are disabled. Every protected operation uses the database-backed
  verifier; cookie presence or a client-side session display is insufficient.
- Logout validates origin, awaits supported current-session revocation, then
  clears cookies. Failure to revoke is a retryable error, not successful logout.
  Other sessions are unaffected, and revoked-cookie replay cannot authenticate.
- Account linking is explicitly disabled, including verified same-email OAuth
  identities. Registration cannot add a password to an existing account.
- Duplicate registration is generic and does not sign the user in. Password
  failures do not reveal whether an email has an account or password method.
- Library rate limiting is enabled in development and production with shared
  database storage. Untrusted forwarding headers cannot choose a fresh bucket;
  the no-proxy default shares a bucket per auth endpoint.
- Storage/configuration outages fail closed. Passwords, session credentials,
  provider tokens, and raw auth errors are never public output or log payloads.

## Protected surface and errors

- `/login`, `/register`, `/api/health`, and the necessary auth protocol routes
  are public. `/`, `/timeline`, `/map`, `/recap`, `/profile`, and existing
  sandbox pages are private; no landing redesign
  is included. Signed-out private page requests redirect to `/login`.
- Every wins API returns the existing structured 401 when there is no valid
  session, before validating its body or querying wins. Foreign/absent wins
  continue to return indistinguishable 404s.
- Authenticated wins writes validate same-origin requests before mutation;
  authentication still precedes input/origin errors for signed-out callers.
- Return URLs are restricted to local allowed paths. Mutating auth requests
  retain CSRF/origin validation, and the auth catch-all does not expose unused
  profile, password-management, recovery, or linking operations.
- Auth JSON errors use `{ error: { code, message } }` at the HTTP boundary.
  Invalid credentials use 401, rate limits 429 with Retry-After, and known
  auth-storage/configuration unavailability 503. Unexpected failures use a
  generic 500. OAuth redirects preserve the library's required cookies/state.
- `/api/health` remains public and does not import or initialize authentication.

## Data and environment

An append-only auth migration preserves existing users, wins, values, and
ownership. Legacy users receive no fabricated credentials or auto-linked
provider account; a matching email cannot claim their wins. Case-folded email
collisions require a safe preflight failure rather than silent merging or
destructive normalization.

Configuration is `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the GitHub
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` pair, plus existing database settings.
Only configured GitHub credentials enable that provider; core auth remains
fail-closed without its signing secret/canonical URL. The password path needs
no cloud account. Development and production use the same verified auth code,
with neither a bypass nor a checked-in secret. Setup belongs in the auth
package README and the authentication setup runbook, not in committed `.env`
files. Password recovery, email verification, profile editing, and extra
providers remain follow-up work.

## Verify

Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.
Exercise the real library and adapter for password/GitHub account resolution,
session persistence, expiry, current-session revocation, copied-cookie replay,
duplicate-account rejection, limiter persistence, cross-user wins isolation,
signed-out redirects/401s, and outage failures. Complete the manual keyboard
and live GitHub drills in [authentication/sign-in.md](authentication/sign-in.md);
report missing credentials and browser limitations explicitly.

## Key ADRs

- [ADR-0012](../adr/0012-password-github-database-sessions.md) — accepted
  replacement for the stub and the unsupported Auth.js Credentials/database
  combination.
- [ADR-0003](../adr/0003-dev-identity-stub.md) — unchanged historical stub decision.
- [ADR-0009](../adr/0009-domain-web-only.md) — application validation/query boundary.
