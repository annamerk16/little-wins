import { randomUUID } from "node:crypto";
import { AuthUnavailableError, currentUserId } from "#auth";
import { mutationOriginAllowed } from "#auth/http";
import { attachWinPhoto, getWinPhoto, MAX_WIN_PHOTO_BYTES, WinPhoto, winPhotoFormat } from "#domain";
import { downloadAttachment, uploadAttachment } from "#services";
import { log } from "#log";

type Context = { params: Promise<{ id: string }> };

const MAX_MULTIPART_BYTES = MAX_WIN_PHOTO_BYTES + 64 * 1024;
const STORAGE_TIMEOUT_MS = 15_000;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: PRIVATE_HEADERS });
}

function storageError(err: unknown, method: "GET" | "PUT") {
  log.error({ err, route: `${method} /api/wins/:id/photo` }, "Win photo storage unavailable");
  return errorResponse(503, "STORAGE_UNAVAILABLE", "Photo storage is temporarily unavailable.");
}

async function parsePhoto(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!request.body || !contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return errorResponse(400, "INVALID_PHOTO", "Select one photo to upload.");
  }

  let bytes = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_MULTIPART_BYTES) throw new Error("Photo request too large");
      controller.enqueue(chunk);
    },
  }));

  let form: FormData;
  try {
    form = await new Response(body, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    return errorResponse(400, "INVALID_PHOTO", bytes > MAX_MULTIPART_BYTES
      ? "Choose a photo up to 5 MiB."
      : "Select one photo to upload.");
  }

  const fields = Array.from(form.entries());
  const parsed = WinPhoto.safeParse(fields.length === 1 && fields[0][0] === "photo" ? fields[0][1] : null);
  if (!parsed.success) {
    return errorResponse(400, "INVALID_PHOTO", parsed.error.issues[0].message);
  }

  const data = await parsed.data.arrayBuffer();
  const format = winPhotoFormat(data);
  if (!format) return errorResponse(400, "INVALID_PHOTO", "Choose a JPEG, PNG, or WebP photo.");
  return { data, ...format };
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const userId = await currentUserId(request);
    if (!userId) return errorResponse(401, "UNAUTHENTICATED", "Sign in required");
    if (!mutationOriginAllowed(request)) return errorResponse(403, "BAD_ORIGIN", "Request origin is not allowed");

    const { id } = await params;
    const win = { id, userId };
    const existing = await getWinPhoto(win);
    if (!existing) return errorResponse(404, "NOT_FOUND", "Win not found");
    if (existing.photoBlobKey) return new Response(null, { status: 204 });

    const photo = await parsePhoto(request);
    if (photo instanceof Response) return photo;

    let photoBlobKey: string;
    try {
      // A concurrent attempt gets its own blob so it cannot overwrite the stored photo.
      photoBlobKey = await uploadAttachment(id, `${randomUUID()}.${photo.extension}`, photo.contentType,
        photo.data, AbortSignal.timeout(STORAGE_TIMEOUT_MS));
    } catch (err) {
      return storageError(err, "PUT");
    }

    const attached = await attachWinPhoto({ ...win, photoBlobKey });
    if (!attached && !(await getWinPhoto(win))) return errorResponse(404, "NOT_FOUND", "Win not found");
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthUnavailableError) return errorResponse(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable");
    log.error({ err, route: "PUT /api/wins/:id/photo" }, "Failed to attach win photo");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to attach photo");
  }
}

export async function GET(request: Request, { params }: Context) {
  try {
    const userId = await currentUserId(request);
    if (!userId) return errorResponse(401, "UNAUTHENTICATED", "Sign in required");

    const { id } = await params;
    const win = await getWinPhoto({ id, userId });
    if (!win?.photoBlobKey) return errorResponse(404, "NOT_FOUND", "Photo not found");

    let photo;
    try {
      photo = await downloadAttachment(win.photoBlobKey, AbortSignal.timeout(STORAGE_TIMEOUT_MS));
    } catch (err) {
      return storageError(err, "GET");
    }
    if (!photo) return errorResponse(404, "NOT_FOUND", "Photo not found");

    return new Response(photo.data, { headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": photo.contentType,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (err) {
    if (err instanceof AuthUnavailableError) return errorResponse(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable");
    log.error({ err, route: "GET /api/wins/:id/photo" }, "Failed to load win photo");
    return errorResponse(500, "INTERNAL_ERROR", "Unable to load photo");
  }
}
