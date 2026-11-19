import { authEnvironment, AuthUnavailableError, getAuthentication } from "#auth/server";
import { authError, handleAuthentication } from "#auth/http";
import { registrationEmailExists, validateAuthInput } from "#domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    return await handleAuthentication(request, {
      auth: getAuthentication(), environment: authEnvironment(),
      validateInput: validateAuthInput, emailExists: registrationEmailExists,
    });
  } catch (error) {
    return error instanceof AuthUnavailableError
      ? authError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable. Please try again.")
      : authError(500, "INTERNAL_ERROR", "Authentication failed. Please try again.");
  }
}

export { handle as GET, handle as POST };
