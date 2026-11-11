# Authentication is not configured or cannot connect

**Use when:** preparing password/GitHub authentication locally or diagnosing a failed login.
**Last drilled:** real-library/PGlite, OAuth-provider fixtures, and Next.js HTTP
registration/login/refresh/logout/authorization checks with disposable in-memory
data passed. Live GitHub and keyboard checks remain pending.

## Before you start

- Use Node and the repository's pinned pnpm. In Windows PowerShell, use `pnpm.cmd` if execution policy blocks `pnpm.ps1`; do not change system policy.
- Keep existing database files and users. These steps apply an additive migration, not a reset.
- Keep secrets in your shell or secret manager. Do not commit secrets, paste them into issues, or edit `.env` files as part of agent work.
- Have a GitHub OAuth application client ID/secret only if checking GitHub login; password login needs no GitHub account or email service.

## Steps

1. From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm prisma:generate`.
2. In terminal one, run `pnpm db:dev` and wait for `postgres ready`. New migrations auto-apply on startup. For an already running database, run `pnpm db:migrate` instead. Never run `db:reset` or `prisma db push` for this change.
3. If the migration reports case-insensitive legacy email duplicates, stop and arrange a reviewed resolution with the data owner. The migration deliberately preserves conflicting records instead of merging them.
4. In terminal two, set the core environment variables and leave this shell open:

   ```powershell
   $env:BETTER_AUTH_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
   $env:BETTER_AUTH_URL = 'http://localhost:3000'
   ```

   Keep the same secret across server restarts if existing sessions should remain valid. `DATABASE_URL` is optional for embedded local Postgres and required for a remote database; use the existing database setup. The secret must contain at least 32 random bytes. Production uses an explicit HTTPS canonical URL and a persistent secret supplied through configuration.
5. For GitHub, create an OAuth App in GitHub Settings → Developer settings → OAuth Apps. Set homepage to `http://localhost:3000` and authorization callback to `http://localhost:3000/api/auth/callback/github`. Use a separate app for production, with its HTTPS origin/callback. The provider requests `read:user` and `user:email` to resolve private email addresses.
6. For GitHub, set both values in terminal two, replacing placeholders without committing the values:

   ```powershell
   $env:GITHUB_CLIENT_ID = '<OAuth app client ID>'
   $env:GITHUB_CLIENT_SECRET = '<OAuth app client secret>'
   ```

   Without this pair the GitHub button is disabled and the password path still works. Never configure provider trust/account-linking to bypass an email conflict.
7. In terminal two, run `pnpm dev:web`. This separate database/web startup also avoids the existing Windows quoting problem in the unrelated root `dev` command.
8. Open `/register`, create an account with a valid email and a 12–128 character password, then sign in at `/login`. Registration's generic completion does not sign you in and does not disclose duplicate accounts.
9. Refresh a private page. Confirm the same session user. Sign out, then request a private page again and confirm a login redirect; a wins API request without a valid cookie returns structured 401. Confirm another user's win returns 404 under your session.
10. Try GitHub approval and denial, first/repeat login, and the same-email conflict with a password account. A conflict must not link or claim the existing user's data. Use non-sensitive test accounts; do not print provider/session tokens.
11. Test keyboard-only forms, pending/error states, database outage/recovery, and successful logout invalidation. Keep copied cookies only in test memory and destroy them afterwards.
12. Stop owned servers before building and run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, and `pnpm build`.

## Verify it worked

- Password and GitHub login resolve verified users through the same database session mechanism. Refresh retains login; sessions expire absolutely after seven days. Logout revokes only the current session before clearing cookies.
- Old demo/legacy wins remain with their original owners. A new registration never receives those wins just because its email matches.
- The default rate limits are shared by clients at each endpoint: five password requests/minute and three registrations/minute, backed by the database and active in development. Forged forwarded-IP headers do not create a new bucket. Wait for Retry-After rather than disabling the limiter.
- `/api/health` stays public and independent of authentication setup. Auth configuration/storage failures return a safe error; no development identity is substituted.

## If this didn't work

- Missing core settings: check whether both core variables are present in the shell launching web. Do not print their values. Restart web after setting them.
- OAuth callback mismatch: compare the canonical origin, registered callback, and running port exactly. Use the matching development/production OAuth app; do not disable origin/state checks.
- Account conflict: use the account's original sign-in method. Linking, recovery, and ownership migration require separate work.
- Database/migration failure: inspect the first error and follow the existing database runbook/spec. Do not delete local data or modify applied migrations.
- Logout failure: restore database access and retry. Cookie clearing alone is not proof that a copied session has been revoked.

## Before production rollout

1. Review the shared rate-limit bucket with the deployment owner. As shipped,
   all clients share five password attempts/minute; one caller can therefore
   temporarily throttle other users. Do not assume the local default is a
   per-user or per-IP production limit.
2. Define and test the trusted proxy boundary before configuring an IP header.
   The proxy must overwrite client-supplied values, and direct access to the
   application must be blocked. Add reviewed deployment configuration and a
   spoofing/concurrency drill; do not simply trust arbitrary forwarded headers
   or disable the limiter. This runbook note does not enable any new trust.
3. Finish live GitHub approval/denial and keyboard-only checks for login,
   registration, sidebar navigation, and sign-out before leaving draft.

## Teammate onboarding notice

When the authentication change lands, share the setup-guide link with the
team and include these facts:

- Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in the shell launching web;
  use a stable per-developer secret across restarts. GitHub additionally needs
  its OAuth client ID/secret pair. Do not share actual secrets in a channel.
- Register a real account and use a session cookie, plus a matching Origin
  header, for authenticated curl writes; there is no `demo-user` fallback.
- Existing local demo-user wins remain intact with their original owner.
  Registering with a matching email cannot claim them. Do not reset data or
  reassign ownership as an onboarding shortcut; ownership recovery is follow-up work.

## Related

- [Authentication feature](../specs/authentication/sign-in.md)
- [Identity contract](../specs/auth.md)
- [Auth library decision](../adr/0012-password-github-database-sessions.md)
