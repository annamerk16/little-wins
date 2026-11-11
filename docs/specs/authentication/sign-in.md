---
type: feature
---
# Users register, sign in with a password or GitHub, and sign out

## Why

Users access their own Little Wins through verified sessions that survive
refresh, without depending on a development identity or exposing other
users' wins. Both password and GitHub login are available.

## Where it lives

- `packages/auth/` — supported auth-library configuration, Prisma adapter,
  session identity, request handling, and browser-safe client entry point.
- `packages/domain/` — application registration and login input schemas.
- `packages/db/prisma/schema.prisma` and a new `0002_authentication.sql`
  migration — User additions and supported account/session/state/limiter tables.
- `apps/web/app/api/auth/[...all]/route.ts` — the necessary auth endpoints
  with application error mapping and request-security enforcement.
- `apps/web/app/login/` and `apps/web/app/register/` — minimal forms.
- `apps/web/app/(private)/` — existing root and sandbox pages under a
  server-checked layout, with their URLs and content preserved.
- Existing wins API handlers — session-derived identity and ownership checks.
- `tests/integration/` and auth package tests — real auth/adapter/session
  behavior, HTTP authorization, provider-boundary fixtures, and migration checks.
- `packages/auth/README.md` and `docs/runbooks/authentication-setup.md` —
  configuration and manual setup; `.env` files are not modified.

## Behavior

### Registration and password login

`/register` has email and password inputs; no profile editor or optional
identity fields are added. Email is trimmed, lowercased, syntactically
validated, and capped at 254 characters. Passwords contain 12–128 characters,
are never trimmed, and are rejected before expensive hashing if oversized.
The library-required initial display name is a fixed neutral default and
does not serve as identity. Client feedback is advisory; server validation
is authoritative and rejects unexpected writable identity fields.

Passwords are salted and hashed through the library's supported scrypt
implementation; plaintext is neither stored, logged, nor returned. Creating
the User and credential account is transactional. Database uniqueness handles
simultaneous registrations without overwriting existing credentials or wins.

Registration has `autoSignIn: false`: valid new and already-registered emails
receive the same public status, body shape, and generic completion message,
and no session cookie. The user then signs in at `/login`. An existing
GitHub-only or legacy account never receives a password through signup.
Case-insensitive duplicates, including existing mixed-case addresses, are
blocked safely without changing old addresses or merging users.

`/login` has email/password and a GitHub button. A wrong password, unknown
email, GitHub-only account, or legacy account without a password gets the
same 401 `INVALID_CREDENTIALS` message: "Email or password is incorrect."
Comparable password-hash work covers unknown/missing-credential paths;
no response or public log reveals whether an account exists.

Password login is limited to five requests per 60 seconds per endpoint
bucket, including failures and successes. Registration is limited to three
per 60 seconds. The library limiter is enabled in every environment, uses
shared database storage, and returns 429 `RATE_LIMITED` with `Retry-After`.
The direct/local default trusts no forwarded-IP headers and uses one shared
bucket per endpoint; changing a forged header cannot reset the limit.
The supported limiter is exercised through HTTP handlers, not rate-limit-
bypassing server API calls. Auth/limiter database failure fails closed.

### GitHub

GitHub login uses the library's OAuth authorization-code flow, state/PKCE
where supported, trusted-origin/callback validation, and stable provider
account ID. The library handles protocol details. OAuth denial, missing
email, invalid/replayed state, or failed exchange yields a safe login error
and no authenticated session. Required GitHub email permission is documented.

A first valid GitHub login creates a User and GitHub account only if there
is no conflicting email/account. Subsequent logins resolve the existing
provider identity, including when the provider's display name/email changes.
Account linking is explicitly disabled. Same-email password, GitHub, and
legacy accounts are never implicitly combined; conflicts return a generic
failure without granting access or rewriting ownership. Explicit linking is
also outside this initial scope.

### Sessions, protection, and sign-out

Both methods use the same opaque, server-side database session and HttpOnly,
SameSite=Lax cookie, Secure over HTTPS. The session has an absolute seven-day
expiry, no sliding renewal, and no cookie session-data cache. Refresh and
later requests reuse the cookie and verify the database session. There is
no browser localStorage token or fallback development identity.

`currentUserId()` returns only the valid session's User ID or null. Forged,
expired, revoked, missing, and deleted-user sessions authenticate nobody.
Development headers and identity flags cannot override the result. Auth
storage outages produce a safe service error rather than a fabricated login.

`/`, `/timeline`, `/map`, `/recap`, `/profile`, sandbox pages, and other
private pages check the session on the server
and redirect signed-out users to `/login` with an allowlisted local return
path. Both direct page requests and private server operations are protected;
a middleware cookie-presence check is never the sole authorization gate.
Public pages are `/login` and `/register`; `/api/health` stays public and
dependency-light. No new public landing page is introduced.

Every wins API derives identity before body validation or data access.
Signed-out requests receive 401
`{ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }`.
Authenticated list/create requests use the session user; foreign and unknown
win IDs both return 404 for detail and deletion. Supplying a user ID in a
header, body, URL, or query parameter cannot change ownership.
Authenticated wins writes also require a same-origin request to protect
cookie-based sessions against cross-site request forgery.

A minimal sign-out action is added to existing private pages. POST logout
validates origin, verifies the current session, awaits supported revocation
of that session, and then clears its cookie and redirects to `/login`.
Replaying the previous cookie after successful logout gets 401. Other
sessions remain valid. Already signed-out logout is idempotent. Revocation
or database failure returns a safe retryable error and does not claim
success or clear the cookie before revocation can be retried.

All application-facing JSON failures, including library failures at the
HTTP boundary, use `{ error: { code, message } }`; redirects remain redirects
and retain necessary cookies/headers. Invalid input gets 400, failed login
401, rejected origin 403, throttling 429, and auth-storage/configuration
unavailability 503. Unexpected failures are safe 500s. Raw library/database
errors, secrets, passwords, cookies, and OAuth tokens never reach public UI
or logs. Forms show pending/error states and preserve email, but do not
persist passwords. Mutating auth endpoints retain the library's CSRF/origin
checks. Unused auth/profile/recovery/linking endpoints are not exposed.

### Data preservation and configuration

The append-only migration adds the auth adapter's required User metadata
with safe defaults and nullable fields, plus its supported auth/state tables
and limiter storage. It preserves all existing User IDs, emails, names,
timestamps, Win rows, and foreign keys. It creates no password or auth account
for legacy users, performs no destructive normalization, and never assigns
old wins to a newly created identity. Legacy case-folded email conflicts
are detected before adding case-insensitive uniqueness: a conflict aborts
the migration transaction with an actionable setup error and no data edits.
Otherwise a unique lower-email index protects case-variant signup races.
Automatic account recovery is absent.

Runtime requires `BETTER_AUTH_SECRET` (at least 32 random bytes) and an
explicit canonical `BETTER_AUTH_URL`. GitHub uses `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`; local callback is
`http://localhost:3000/api/auth/callback/github`. Production uses the
deployment's HTTPS origin. No secret has a committed default. Missing
GitHub credentials disable only GitHub login with a clear setup message;
password login remains available. Missing core auth configuration fails
closed while public health remains independent. Setup is documented without
reading or committing secrets or editing `.env` files.

## Examples

| State / input | Observable result |
|---|---|
| New valid registration | One User and salted credential; generic completion; then login |
| Existing email, including concurrent/case-variant signup | Same generic completion; no password replacement or extra account |
| Password has 11, 12, 128, or 129 characters | Reject, accept, accept, reject respectively |
| Unknown email or wrong password | Identical structured 401 and no session |
| Sixth password request inside 60 seconds | 429 and Retry-After; spoofing forwarded headers does not bypass it |
| GitHub identity with a matching password-account email | Safe failure; no link and no access to existing wins |
| Correct login, then refresh | Same authenticated user and own wins |
| Missing/forged/expired/revoked cookie | Login redirect for private pages; structured 401 for wins APIs |
| User A requests User B's win | 404; B's win is unchanged |
| Logout succeeds, then old cookie is replayed | Structured 401; another valid session is unaffected |
| Database fails during revocation | Retryable error; logout is not reported complete |
| Migration runs over existing users/wins | IDs, ownership, counts, and existing values are unchanged |

## Verify

- Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.
  Root integration tests remain an explicit separate command because the
  existing default test script runs workspace tests only.
  CI runs both commands before building, so the authentication security
  tests are exercised on every pull request.
- Run real library/Prisma/PGlite tests for registration, hashing, valid/invalid
  login, duplicate/racing/case-variant signup, persistent sessions, expiry,
  logout revocation, copied-cookie replay, and independent sessions.
- Exercise HTTP handlers with real issued session cookies for signed-out
  list/create/detail/delete, valid ownership, foreign 404, malicious IDs,
  origin rejection, safe auth error mapping, and absence of identity bypasses.
  Do not replace session verification with a mock current-user function in
  the security proofs. Pure validation tests cover boundary inputs.
- Test rate limits across distinct auth instances sharing the database,
  spoofed forwarding headers, concurrent attempts, and window expiry.
- Test GitHub's boundary with mocked provider responses while retaining real
  OAuth state, account resolution, cookies, and adapter operations: first and
  repeat login, same-email rejection, failed/cancelled/replayed callback.
  Fixtures are not reported as a live GitHub login.
- Apply migrations to an in-memory database containing the previous schema
  and representative users/wins; compare values, IDs, relationships, and counts.
- After configuration, manually register, sign in, refresh, use two users'
  private pages/wins, sign out, and retry an old session. Test keyboard-only
  forms, GitHub approval/denial, and database outage/recovery. Record missing
  OAuth credentials or unavailable browser access as unverified checks.

## Constraints & decisions

- [ADR-0012](../../adr/0012-password-github-database-sessions.md) adopts the
  reviewed supported library change while retaining database sessions.
- Only authentication is added. Existing product screens keep their layout
  and URLs; root/sandbox protection and minimal auth controls are necessary.
- New dependencies are limited to the supported auth library and Prisma
  adapter. Existing Zod and Prisma support input validation and persistence.
- Session/account persistence belongs to the supported adapter. The feature
  introduces neither a homemade session protocol nor a second auth system.
- Email verification is intentionally deferred. A password account's email
  is not proof of mailbox ownership and never authorizes account linking.
- Old demo/legacy wins remain with their original users. Enabling access to
  those users without a pre-existing verified login requires follow-up work.

## Out of scope

Password recovery, email verification, profile/name/email/password editing,
account linking/merging/recovery, extra providers, MFA, roles, public landing
pages, timeline/dialog integration, seed/startup fixes, deployment/proxy
configuration, database resets, branch merges, pushes, and deployments.
