import {
  AuthUnavailableError, safeReturnPath, verifiedSession,
  type Authentication, type AuthEnvironment,
} from "./config";

type CredentialValidation = { success: true; data: { email: string; password: string } }
  | { success: false; error: { issues: { message: string }[] } };
type Dependencies = {
  auth: Authentication;
  environment: AuthEnvironment;
  validateInput: (path: string, body: unknown) => CredentialValidation;
  emailExists: (email: string) => Promise<boolean>;
};

export function authError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export function mutationOriginAllowed(request: Request,
  origin = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin) {
  return request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

async function readJSON(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Invalid input");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error("Invalid input"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const ALLOWED = new Map([
  ["/sign-up/email", "POST"], ["/sign-in/email", "POST"],
  ["/sign-in/social", "POST"], ["/sign-out", "POST"],
  ["/get-session", "GET"], ["/callback/github", "GET"],
]);

const registrationComplete = () => Response.json({
  success: true, message: "Registration complete. You can try signing in.",
});

export async function handleAuthentication(request: Request, deps: Dependencies): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice("/api/auth".length);
  const expectedMethod = ALLOWED.get(path);
  if (!expectedMethod) return authError(404, "NOT_FOUND", "Not found");
  if (request.method !== expectedMethod) return authError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  const { auth, environment } = deps;
  if (request.method === "POST" && !mutationOriginAllowed(request, environment.baseURL)) {
    return authError(403, "BAD_ORIGIN", "Request origin is not allowed");
  }
  let email: string | undefined;
  try {
    let prepared = request;
    if (request.method === "POST") {
      let body: unknown;
      try { body = await readJSON(request); }
      catch { return authError(400, "VALIDATION", "Send a valid JSON authentication request"); }
      let forwardedBody: Record<string, unknown>;
      if (path === "/sign-up/email" || path === "/sign-in/email") {
        const parsed = deps.validateInput(path, body);
        if (!parsed.success) return authError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input");
        email = parsed.data.email;
        forwardedBody = path === "/sign-up/email"
          ? { ...parsed.data, name: "Little Wins user" }
          : { ...parsed.data, rememberMe: true };
      } else if (path === "/sign-in/social") {
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 1 || (body as { provider?: unknown }).provider !== "github") {
          return authError(400, "VALIDATION", "Choose GitHub to sign in");
        }
        if (!environment.github) return authError(503, "GITHUB_UNAVAILABLE", "GitHub sign-in is not configured");
        forwardedBody = {
          provider: "github",
          callbackURL: `${environment.baseURL}${safeReturnPath(url.searchParams.get("returnTo"))}`,
          errorCallbackURL: `${environment.baseURL}/login?error=github`,
        };
      } else {
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) {
          return authError(400, "VALIDATION", "Invalid sign-out request");
        }
        // The library's ordinary sign-out is best-effort. Await its supported
        // revocation API first so a database failure cannot look like success.
        const session = await verifiedSession(auth, request.headers);
        if (session) {
          try { await auth.api.revokeSession({ headers: request.headers, body: { token: session.session.token } }); }
          catch { throw new AuthUnavailableError(); }
        }
        forwardedBody = {};
      }
      const forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.delete("content-length");
      prepared = new Request(request.url, { method: "POST", headers: forwardedHeaders, body: JSON.stringify(forwardedBody) });
    }
    let response: Response;
    try { response = await auth.handler(prepared); }
    catch { throw new AuthUnavailableError(); }
    if (response.status >= 300 && response.status < 400) return response;
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (path === "/sign-up/email") {
      if (response.ok) return registrationComplete();
      // Case-insensitive index and concurrent-create errors must not enumerate
      // legacy accounts. The existence lookup never attaches a credential.
      if (email && response.status === 422 && await deps.emailExists(email)) return registrationComplete();
      if (response.status === 422) throw new AuthUnavailableError();
    }
    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after") ?? response.headers.get("x-retry-after") ?? "60";
        return authError(429, "RATE_LIMITED", "Too many attempts. Try again shortly.", { "Retry-After": retryAfter });
      }
      if (path === "/sign-in/email" && response.status === 401) {
        return authError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      if (response.status >= 500) throw new AuthUnavailableError();
      return authError(response.status, "AUTH_FAILED", "Authentication failed. Please try again.");
    }
    // Keep library cookie semantics but do not expose session/provider tokens in JSON.
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "no-store");
    if (path === "/sign-in/social") return Response.json({ url: body?.url }, { headers });
    if (path === "/get-session") {
      const data = body as { user?: { id: string; email: string }; session?: { expiresAt: string } } | null;
      return Response.json(data?.user ? { user: data.user, expiresAt: data.session?.expiresAt } : null, { headers });
    }
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return error instanceof AuthUnavailableError
      ? authError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable. Please try again.")
      : authError(500, "INTERNAL_ERROR", "Authentication failed. Please try again.");
  }
}
