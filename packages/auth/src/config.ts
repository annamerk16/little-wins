import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "#database";

export class AuthUnavailableError extends Error {
  constructor() { super("Authentication is temporarily unavailable"); }
}

export type AuthEnvironment = {
  secret: string;
  baseURL: string;
  github?: { clientId: string; clientSecret: string };
};

export function authEnvironment(): AuthEnvironment {
  const secret = process.env.BETTER_AUTH_SECRET;
  const url = process.env.BETTER_AUTH_URL;
  if (!secret || Buffer.byteLength(secret) < 32 || !url) throw new AuthUnavailableError();
  let origin: URL;
  try { origin = new URL(url); } catch { throw new AuthUnavailableError(); }
  if (origin.origin !== url.replace(/\/$/, "") || origin.username || origin.password ||
      !["http:", "https:"].includes(origin.protocol) ||
      (process.env.NODE_ENV === "production" && origin.protocol !== "https:")) {
    throw new AuthUnavailableError();
  }
  const github = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;
  return { secret, baseURL: origin.origin, github };
}

export function createAuthentication(db: PrismaClient, env: AuthEnvironment) {
  return betterAuth({
    appName: "Little Wins",
    baseURL: env.baseURL,
    secret: env.secret,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      requireEmailVerification: false,
    },
    socialProviders: env.github ? { github: env.github } : {},
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    verification: { storeInDatabase: true },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: [] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      useSecureCookies: env.baseURL.startsWith("https:"),
    },
    trustedOrigins: [env.baseURL],
    onAPIError: { errorURL: `${env.baseURL}/login` },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

export type Authentication = ReturnType<typeof createAuthentication>;

export async function verifiedSession(auth: Authentication, headers: Headers) {
  try {
    return await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  } catch {
    throw new AuthUnavailableError();
  }
}

const PRIVATE_PATHS = new Set([
  "/", "/timeline", "/map", "/recap", "/profile",
  "/sandbox/timeline", "/sandbox/category-filter", "/sandbox/delete-confirm",
]);
export function safeReturnPath(value: unknown): string {
  return typeof value === "string" && PRIVATE_PATHS.has(value) ? value : "/";
}
