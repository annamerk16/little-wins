import { currentUserId } from "@project/auth";
import { categorySchema, listWins } from "@project/domain";
import { log } from "@project/log";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in required");
    }

    const category = new URL(request.url).searchParams.get("category");
    const parsed = categorySchema.optional().safeParse(category ?? undefined);
    if (!parsed.success) {
      return errorResponse(400, "BAD_CATEGORY", "Invalid category");
    }

    const wins = await listWins({ userId, category: parsed.data });
    return Response.json({ wins });
  } catch (err) {
    log.error({ err, route: "GET /api/wins" }, "Failed to list wins");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to load wins");
  }
}
