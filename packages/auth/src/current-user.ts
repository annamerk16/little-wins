import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthentication } from "./server";
import { safeReturnPath, verifiedSession } from "./config";

export async function currentUserId(request?: Request): Promise<string | null> {
  const requestHeaders = request?.headers ?? await headers();
  // No session can exist without a cookie; no identity header or flag is read.
  if (!requestHeaders.get("cookie")) return null;
  return (await verifiedSession(getAuthentication(), requestHeaders))?.user.id ?? null;
}

export async function requireUserId(returnTo = "/"): Promise<string> {
  const id = await currentUserId();
  if (!id) redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return id;
}
