import { prisma } from "#database";
import { authEnvironment, createAuthentication, type Authentication } from "./config";

let instance: Authentication | undefined;
export function getAuthentication() {
  return instance ??= createAuthentication(prisma, authEnvironment());
}

export { authEnvironment, AuthUnavailableError, safeReturnPath } from "./config";
