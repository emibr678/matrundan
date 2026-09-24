import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(status: number, code: string) {
  return Response.json(
    { error: code },
    {
      status,
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json",
      },
    },
  );
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED");

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonError(401, "UNAUTHORIZED");

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return jsonError(401, "UNAUTHORIZED");

  const payload = await request.json().catch(() => null);
  const deliveryToken =
    payload && typeof payload.deliveryToken === "string" ? payload.deliveryToken : "";
  if (!UUID_PATTERN.test(deliveryToken)) return jsonError(404, "NOT_FOUND");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonError(503, "BACKEND_UNAVAILABLE");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return jsonError(401, "UNAUTHORIZED");

  const { data: resolved, error: resolveError } = await admin.rpc(
    "resolve_visit_photo_delivery_v1",
    {
      _delivery_token: deliveryToken,
      _viewer_id: user.id,
    },
  );
  if (
    resolveError ||
    !resolved ||
    typeof resolved !== "object" ||
    typeof resolved.storagePath !== "string" ||
    typeof resolved.mimeType !== "string"
  ) {
    return jsonError(404, "NOT_FOUND");
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from("visit-photos")
    .download(resolved.storagePath);
  if (downloadError || !blob) return jsonError(404, "NOT_FOUND");

  return new Response(await blob.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": resolved.mimeType,
      "content-length": String(blob.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
