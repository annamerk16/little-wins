import { AuthUnavailableError, currentUserId } from "@project/auth";
import { mutationOriginAllowed } from "#auth/http";
import { deleteWin, getWin } from "@project/domain";
import { log } from "@project/log";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await currentUserId(request);
    if (!userId) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in required");
    }

    const { id } = await params;
    const win = await getWin({ userId, id });
    if (!win) {
      return errorResponse(404, "NOT_FOUND", "Win not found");
    }

    return Response.json({ win });
  } catch (err) {
    if (err instanceof AuthUnavailableError) return errorResponse(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable");
    log.error({ err, route: "GET /api/wins/:id" }, "Failed to load win");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to load win");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await currentUserId(request);
    if (!userId) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in required");
    }

    if (!mutationOriginAllowed(request)) return errorResponse(403, "BAD_ORIGIN", "Request origin is not allowed");

    const { id } = await params;
    const deleted = await deleteWin({ userId, id });
    if (!deleted) {
      return errorResponse(404, "NOT_FOUND", "Win not found");
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthUnavailableError) return errorResponse(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable");
    log.error({ err, route: "DELETE /api/wins/:id" }, "Failed to delete win");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to delete win");
  }
}
