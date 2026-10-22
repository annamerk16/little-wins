import { currentUserId } from "@project/auth";
import { categorySchema, listWins, CreateWin, createWin } from "@project/domain";
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

export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in required");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "BAD_JSON", "Body must be valid JSON");
    }

    const parsed = CreateWin.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const win = await createWin({ userId, ...parsed.data });
    return Response.json({ win }, { status: 201 });
  } catch (err) {
    log.error({ err, route: "POST /api/wins" }, "Failed to create win");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to create win");
  }
}
