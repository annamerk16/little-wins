import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthentication, verifiedSession, type Authentication, type AuthEnvironment } from "../../packages/auth/src/config";
import { handleAuthentication } from "../../packages/auth/src/http";
import { validateAuthInput } from "../../packages/domain/src/auth-input";

const baseURL = "http://localhost:3000";
const password = "a long test password";
let db: import("../../packages/db/src/index").PrismaClient;
let auth: Authentication;
let env: AuthEnvironment;
let list: typeof import("../../apps/web/app/api/wins/route").GET;
let create: typeof import("../../apps/web/app/api/wins/route").POST;
let detail: typeof import("../../apps/web/app/api/wins/[id]/route").GET;
let remove: typeof import("../../apps/web/app/api/wins/[id]/route").DELETE;

beforeAll(async () => {
  vi.stubEnv("PGLITE_DATA_DIR", "memory://");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", baseURL);
  vi.stubEnv("DEV_USER_ID", "legacy-bypass-must-not-work");
  vi.stubEnv("ALLOW_DEV_IDENTITY", "true");
  ({ prisma: db } = await import("../../packages/db/src/index"));
  env = { baseURL, secret: process.env.BETTER_AUTH_SECRET! };
  auth = createAuthentication(db, env);
  ({ GET: list, POST: create } = await import("../../apps/web/app/api/wins/route"));
  ({ GET: detail, DELETE: remove } = await import("../../apps/web/app/api/wins/[id]/route"));
}, 30000);

beforeEach(async () => {
  await db.win.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.rateLimit.deleteMany();
  await db.user.deleteMany();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await db?.$disconnect(); vi.unstubAllEnvs(); });

function jar(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}
async function call(path: string, body?: unknown, cookie = "", instance = auth, environment = env, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("origin", environment.baseURL);
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return handleAuthentication(new Request(`${environment.baseURL}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST", headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    auth: instance, environment, validateInput: validateAuthInput,
    emailExists: async (email) => (await db.user.count({ where: { email: { equals: email, mode: "insensitive" } } })) > 0,
  });
}
async function register(email = "owner@example.com") {
  const response = await call("/sign-up/email", { email, password });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  return response;
}
async function login(email = "owner@example.com") {
  const response = await call("/sign-in/email", { email, password });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  return { cookie: jar(response), response };
}
function winsRequest(method: string, cookie = "", body?: unknown, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  if (!headers.has("origin")) headers.set("origin", baseURL);
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${baseURL}/api/wins`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("real password authentication and database sessions", () => {
  it("hashes passwords, keeps duplicate registration indistinguishable, and never replaces credentials", async () => {
    const first = await register();
    expect(first.headers.get("set-cookie")).toBeNull();
    const account = await db.account.findFirstOrThrow();
    expect(account.password).not.toBe(password);
    expect(account.password!.length).toBeGreaterThan(64);
    expect(await db.session.count()).toBe(0);
    const duplicate = await call("/sign-up/email", { email: " Owner@Example.COM ", password: "a different password" });
    expect(duplicate.status).toBe(first.status);
    expect(await duplicate.json()).toEqual(await first.json());
    expect(await db.user.count()).toBe(1);
    expect(await db.account.findFirstOrThrow()).toEqual(account);
    await login();
  }, 30000);

  it("does not let signup claim a legacy mixed-case email or its wins", async () => {
    const legacy = await db.user.create({ data: { email: "Legacy@Example.com" } });
    const win = await db.win.create({ data: { userId: legacy.id, reflection: "Protected", category: "PERSONAL", latitude: 0, longitude: 0 } });
    const response = await register("legacy@example.com");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(0);
    expect(await db.win.findUnique({ where: { id: win.id } })).toMatchObject({ userId: legacy.id });
  }, 30000);

  it("returns the same login failure for unknown email, wrong password, and an account without a password", async () => {
    await register();
    await db.user.create({ data: { email: "oauth@example.com" } });
    const failures = [];
    for (const email of ["missing@example.com", "owner@example.com", "oauth@example.com"]) {
      const result = await call("/sign-in/email", { email, password: "the wrong password" });
      expect(result.status).toBe(401);
      expect(result.headers.get("set-cookie")).toBeNull();
      failures.push(await result.json());
    }
    expect(failures).toEqual(Array(3).fill({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }));
  }, 30000);

  it("persists a session across requests/instances and expires it without trusting forged cookies", async () => {
    await register();
    const { cookie, response } = await login();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(await response.json()).toEqual({ success: true });
    const session = await verifiedSession(auth, new Headers({ cookie }));
    expect(session?.user.email).toBe("owner@example.com");
    const stored = await db.session.findFirstOrThrow();
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeCloseTo(7 * 24 * 3600 * 1000, -3);
    const anotherInstance = createAuthentication(db, env);
    expect((await verifiedSession(anotherInstance, new Headers({ cookie })))?.user.id).toBe(session?.user.id);
    expect((await db.session.findFirstOrThrow()).expiresAt).toEqual(stored.expiresAt);
    expect(await verifiedSession(auth, new Headers({ cookie: "better-auth.session_token=forged" }))).toBeNull();
    await db.session.update({ where: { id: stored.id }, data: { expiresAt: new Date(0) } });
    expect(await verifiedSession(auth, new Headers({ cookie }))).toBeNull();
  }, 30000);

  it("uses Secure cookies on HTTPS", async () => {
    const httpsEnv = { ...env, baseURL: "https://littlewins.example" };
    const httpsAuth = createAuthentication(db, httpsEnv);
    await call("/sign-up/email", { email: "secure@example.com", password }, "", httpsAuth, httpsEnv);
    const response = await call("/sign-in/email", { email: "secure@example.com", password }, "", httpsAuth, httpsEnv);
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && value.includes("; Secure"))).toBe(true);
  }, 30000);

  it("revokes only the current session; copied cookies fail and repeated logout is harmless", async () => {
    await register();
    const first = await login();
    const second = await login();
    const result = await call("/sign-out", {}, first.cookie);
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await verifiedSession(auth, new Headers({ cookie: first.cookie }))).toBeNull();
    expect(await verifiedSession(auth, new Headers({ cookie: second.cookie }))).not.toBeNull();
    expect((await list(winsRequest("GET", first.cookie))).status).toBe(401);
    expect((await call("/sign-out", {}, first.cookie)).status).toBe(200);
  }, 30000);

  it("keeps the cookie and returns an error when database revocation fails, then allows retry", async () => {
    await register();
    const { cookie } = await login();
    await db.$executeRawUnsafe(`CREATE FUNCTION reject_auth_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test revocation failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_delete BEFORE DELETE ON "Session" FOR EACH ROW EXECUTE FUNCTION reject_auth_delete()`);
    try {
      const failure = await call("/sign-out", {}, cookie);
      expect(failure.status).toBe(503);
      expect(failure.headers.get("set-cookie")).toBeNull();
      expect((await failure.json()).error.code).toBe("AUTH_UNAVAILABLE");
      expect(await db.session.count()).toBe(1);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER reject_delete ON "Session"`);
      await db.$executeRawUnsafe(`DROP FUNCTION reject_auth_delete()`);
    }
    expect((await call("/sign-out", {}, cookie)).status).toBe(200);
    expect(await db.session.count()).toBe(0);
  }, 30000);

  it("enforces the shared database limiter across instances, spoofed IPs, concurrency, and window expiry", async () => {
    const other = createAuthentication(db, env);
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => call(
      "/sign-in/email", { email: "missing@example.com", password }, "", index % 2 ? other : auth, env,
      { "x-forwarded-for": `192.0.2.${index}`, "x-real-ip": `192.0.2.${index}` },
    )));
    expect(responses.filter((r) => r.status === 401)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(7);
    const limited = responses.find((r) => r.status === 429)!;
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");
    await db.rateLimit.updateMany({ data: { lastRequest: BigInt(Date.now() - 61000) } });
    expect((await call("/sign-in/email", { email: "missing@example.com", password })).status).toBe(401);
  }, 30000);

  it("rejects cross-origin logout before revocation and exposes no out-of-scope auth operations", async () => {
    await register();
    const { cookie } = await login();
    const response = await handleAuthentication(new Request(`${baseURL}/api/auth/sign-out`, {
      method: "POST", headers: { origin: "https://attacker.example", cookie, "content-type": "application/json" }, body: "{}",
    }), { auth, environment: env, validateInput: validateAuthInput, emailExists: async () => false });
    expect(response.status).toBe(403);
    expect(await verifiedSession(auth, new Headers({ cookie }))).not.toBeNull();
    for (const path of ["/link-social", "/set-password", "/update-user", "/request-password-reset", "/change-email"]) {
      expect((await call(path, {})).status).toBe(404);
    }
  }, 30000);

  it("handles simultaneous registrations atomically and limits repeated signup", async () => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => call("/sign-up/email", { email: "race@example.com", password })));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await Promise.all(responses.map((r) => r.json()))).toEqual(Array(3).fill({ success: true, message: "Registration complete. You can try signing in." }));
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
    expect((await call("/sign-up/email", { email: "another@example.com", password })).status).toBe(429);
  }, 30000);

  it("rolls back signup if credential storage fails and fails closed if limiter storage fails", async () => {
    await db.$executeRawUnsafe(`CREATE FUNCTION reject_auth_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test storage failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_insert BEFORE INSERT ON "Account" FOR EACH ROW EXECUTE FUNCTION reject_auth_insert()`);
    try {
      const result = await call("/sign-up/email", { email: "rollback@example.com", password });
      expect(result.status).toBe(503);
      expect(result.headers.get("set-cookie")).toBeNull();
      expect(await db.user.count()).toBe(0);
      expect(await db.account.count()).toBe(0);
    } finally { await db.$executeRawUnsafe(`DROP TRIGGER reject_insert ON "Account"`); }
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_limit BEFORE INSERT ON "RateLimit" FOR EACH ROW EXECUTE FUNCTION reject_auth_insert()`);
    try {
      const result = await call("/sign-in/email", { email: "missing@example.com", password });
      expect(result.status).toBe(503);
      expect((await result.json()).error.code).toBe("AUTH_UNAVAILABLE");
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER reject_limit ON "RateLimit"`);
      await db.$executeRawUnsafe(`DROP FUNCTION reject_auth_insert()`);
    }
  }, 30000);

  it("rejects cross-origin wins writes and cookies belonging to a deleted user", async () => {
    await register();
    const { cookie } = await login();
    const response = await create(winsRequest("POST", cookie, {
      reflection: "CSRF attempt", category: "PERSONAL", latitude: 0, longitude: 0,
    }, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await db.win.count()).toBe(0);
    const user = await db.user.findFirstOrThrow();
    await db.user.delete({ where: { id: user.id } });
    expect((await list(winsRequest("GET", cookie))).status).toBe(401);
  }, 30000);

  it("authenticates all wins routes from real session cookies and preserves cross-user 404 isolation", async () => {
    await register("a@example.com");
    await register("b@example.com");
    const a = await login("a@example.com");
    const b = await login("b@example.com");
    const userB = (await verifiedSession(auth, new Headers({ cookie: b.cookie })))!.user.id;
    const created = await create(winsRequest("POST", a.cookie, {
      reflection: "Mine", category: "FITNESS", latitude: 0, longitude: 0, userId: userB,
    }));
    expect(created.status).toBe(201);
    const { win } = await created.json();
    expect(win.userId).not.toBe(userB);
    expect((await (await list(winsRequest("GET", b.cookie))).json()).wins).toEqual([]);
    expect((await (await list(winsRequest("GET", b.cookie, undefined, { "x-user-id": win.userId }))).json()).wins).toEqual([]);
    expect((await detail(winsRequest("GET", b.cookie), { params: Promise.resolve({ id: win.id }) })).status).toBe(404);
    expect((await remove(winsRequest("DELETE", b.cookie), { params: Promise.resolve({ id: win.id }) })).status).toBe(404);
    expect(await db.win.findUnique({ where: { id: win.id } })).not.toBeNull();
    const spoof = { "x-user-id": win.userId };
    expect((await list(winsRequest("GET", "", undefined, spoof))).status).toBe(401);
    expect((await create(winsRequest("POST", "", {}, spoof))).status).toBe(401);
    expect((await detail(winsRequest("GET", "", undefined, spoof), { params: Promise.resolve({ id: win.id }) })).status).toBe(401);
    expect((await remove(winsRequest("DELETE", "", undefined, spoof), { params: Promise.resolve({ id: win.id }) })).status).toBe(401);
    expect((await remove(winsRequest("DELETE", a.cookie), { params: Promise.resolve({ id: win.id }) })).status).toBe(204);
  }, 30000);

  it("wires the actual Next auth route to registration, cookies, and the wins session verifier", async () => {
    const { POST } = await import("../../apps/web/app/api/auth/[...all]/route");
    const request = (path: string, body: unknown) => new Request(`${baseURL}/api/auth/${path}`, {
      method: "POST", headers: { origin: baseURL, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    expect((await POST(request("sign-up/email", { email: "route@example.com", password }))).status).toBe(200);
    const signedIn = await POST(request("sign-in/email", { email: "route@example.com", password }));
    expect(signedIn.status).toBe(200);
    expect((await list(winsRequest("GET", jar(signedIn)))).status).toBe(200);
  }, 30000);
});

describe("GitHub protocol boundary with real OAuth state and persistence", () => {
  async function githubFlow(profile: { id: number; email: string; name?: string }, options?: {
    denied?: boolean; tampered?: boolean; noEmail?: boolean; failedExchange?: boolean;
  }) {
    const githubEnv = { ...env, github: { clientId: "fixture-client", clientSecret: "fixture-secret" } };
    const githubAuth = createAuthentication(db, githubEnv);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://github.com/login/oauth/access_token")) {
        if (options?.failedExchange) return Response.json({ error: "bad_verification_code" }, { status: 400 });
        return Response.json({ access_token: "fixture-access-token", token_type: "bearer", scope: "read:user user:email" });
      }
      if (url.startsWith("https://api.github.com/user/emails")) {
        if (options?.noEmail) return Response.json([]);
        return Response.json([{ email: profile.email, verified: true, primary: true }]);
      }
      if (url.startsWith("https://api.github.com/user")) {
        return Response.json({ id: profile.id, login: "fixture", name: profile.name ?? "Fixture user", email: options?.noEmail ? null : profile.email });
      }
      throw new Error("Unexpected provider request");
    }));
    const start = await call("/sign-in/social", { provider: "github" }, "", githubAuth, githubEnv);
    expect(start.status, await start.clone().text()).toBe(200);
    const state = new URL((await start.json()).url).searchParams.get("state")!;
    expect(state).toBeTruthy();
    const query = new URLSearchParams(options?.denied ? { error: "access_denied", state } : { code: "fixture-code", state: options?.tampered ? "tampered" : state });
    const callback = `/callback/github?${query}`;
    const response = await call(callback, undefined, jar(start), githubAuth, githubEnv);
    return { response, cookie: jar(response), githubAuth, githubEnv, callback, stateCookie: jar(start) };
  }

  it("creates a GitHub account, resolves its stable provider identity, and rejects callback replay", async () => {
    const first = await githubFlow({ id: 123, email: "github@example.com" });
    expect(first.response.status).toBe(302);
    const session = await verifiedSession(first.githubAuth, new Headers({ cookie: first.cookie }));
    expect(session?.user.email).toBe("github@example.com");
    const second = await githubFlow({ id: 123, email: "changed@example.com", name: "Changed" });
    expect((await verifiedSession(second.githubAuth, new Headers({ cookie: second.cookie })))?.user.id).toBe(session?.user.id);
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
    const replay = await call(first.callback, undefined, first.stateCookie, first.githubAuth, first.githubEnv);
    expect(jar(replay)).not.toContain("better-auth.session_token=");
    expect(replay.headers.get("location")).toContain("/login");
  }, 30000);

  it("never links a GitHub identity to a matching password email", async () => {
    await register("same@example.com");
    const existing = await db.user.findFirstOrThrow();
    const result = await githubFlow({ id: 321, email: "same@example.com" });
    expect(await verifiedSession(result.githubAuth, new Headers({ cookie: result.cookie }))).toBeNull();
    expect(await db.account.findMany()).toMatchObject([{ providerId: "credential", userId: existing.id }]);
    expect(await db.user.count()).toBe(1);
    expect(result.response.headers.get("location")).toContain("/login");
  }, 30000);

  it.each([
    ["denial", { denied: true }], ["tampered state", { tampered: true }],
    ["missing email", { noEmail: true }], ["failed exchange", { failedExchange: true }],
  ])("fails closed for OAuth %s", async (_label, options) => {
    const result = await githubFlow({ id: 123, email: "github@example.com" }, options);
    expect(await verifiedSession(result.githubAuth, new Headers({ cookie: result.cookie }))).toBeNull();
    expect(result.response.headers.get("location")).toContain("/login");
    expect(await db.session.count()).toBe(0);
  }, 30000);
});
