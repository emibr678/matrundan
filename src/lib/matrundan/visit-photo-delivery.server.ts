import { z } from "zod";

const deliveryTokenSchema = z.string().uuid();

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "cache-control": "private, no-store",
      "www-authenticate": "Bearer",
    },
  });
}

function unavailable() {
  return new Response("Unavailable", {
    status: 502,
    headers: { "cache-control": "private, no-store" },
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

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return unavailable();

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/visit-photo-delivery`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: publishableKey,
        Accept: "image/*",
        "content-type": "application/json",
      },
      body: JSON.stringify({ deliveryToken: parsedToken.data }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return unavailable();
  }

  if (response.status === 401) return unauthorized();
  if (response.status === 403 || response.status === 404) return notFound();
  if (!response.ok || !response.body) return unavailable();

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const contentLength = response.headers.get("content-length");

  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      ...(contentLength ? { "content-length": contentLength } : {}),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
