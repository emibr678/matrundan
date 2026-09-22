import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const deliveryTokenSchema = z.string().uuid();

const resolvedPhotoSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
});

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "cache-control": "private, no-store",
      "www-authenticate": "Bearer",
    },
  });
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function handleVisitPhotoDelivery(
  request: Request,
  deliveryTokenInput: string,
): Promise<Response> {
  const parsedToken = deliveryTokenSchema.safeParse(deliveryTokenInput);
  if (!parsedToken.success) return notFound();

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return unauthorized();
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return unauthorized();

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return unauthorized();

  const { data, error } = await supabaseAdmin.rpc("resolve_visit_photo_delivery_v1", {
    _delivery_token: parsedToken.data,
    _viewer_id: userData.user.id,
  });
  if (error || data == null) return notFound();

  const resolved = resolvedPhotoSchema.safeParse(data);
  if (!resolved.success) return notFound();

  const { data: blob, error: downloadError } = await supabaseAdmin.storage
    .from("visit-photos")
    .download(resolved.data.storagePath);
  if (downloadError || !blob) return notFound();

  return new Response(await blob.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": resolved.data.mimeType,
      "content-length": String(blob.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
