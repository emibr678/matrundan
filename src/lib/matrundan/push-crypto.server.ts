/**
 * Web Push (RFC 8291 / aes128gcm) och VAPID (RFC 8292) med enbart Web Crypto.
 *
 * Serveronly. Implementationen använder aes128gcm eftersom Apples Web Push
 * (iOS på hemskärmen) inte accepterar den äldre aesgcm-kodningen.
 */

const encoder = new TextEncoder();

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(data)));
}

/** HKDF-Expand med en enda block-iteration, vilket räcker för längder <= 32 byte. */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const block = await hmacSha256(prk, concatBytes([info, Uint8Array.of(1)]));
  return block.slice(0, length);
}

/**
 * Krypterar en payload enligt aes128gcm och returnerar den fullständiga kroppen
 * (header-block + chiffertext) som ska POST:as till push-tjänsten.
 */
export async function encryptPushPayload(
  subscription: PushSubscriptionKeys,
  payload: string,
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);

  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const localPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeys.publicKey),
  );

  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(uaPublicBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, localKeys.privateKey, 256),
  );

  // PRK för nyckelhärledning: HMAC(auth_secret, ecdh_secret)
  const authPrk = await hmacSha256(authSecret, sharedSecret);
  const keyInfo = concatBytes([
    encoder.encode("WebPush: info"),
    Uint8Array.of(0),
    uaPublicBytes,
    localPublicBytes,
  ]);
  const ikm = await hkdfExpand(authPrk, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);

  const cek = await hkdfExpand(
    prk,
    concatBytes([encoder.encode("Content-Encoding: aes128gcm"), Uint8Array.of(0)]),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    concatBytes([encoder.encode("Content-Encoding: nonce"), Uint8Array.of(0)]),
    12,
  );

  const aesKey = await crypto.subtle.importKey("raw", toArrayBuffer(cek), { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  // Sista (och enda) posten avslutas med avgränsaren 0x02.
  const plaintext = concatBytes([encoder.encode(payload), Uint8Array.of(2)]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      aesKey,
      toArrayBuffer(plaintext),
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  return concatBytes([
    salt,
    recordSize,
    Uint8Array.of(localPublicBytes.length),
    localPublicBytes,
    ciphertext,
  ]);
}

async function importVapidSigningKey(vapid: VapidConfig): Promise<CryptoKey> {
  const publicBytes = base64UrlToBytes(vapid.publicKey);
  if (publicBytes.length !== 65) {
    throw new Error("VAPID_PUBLIC_KEY måste vara en okomprimerad P-256-punkt (65 byte).");
  }
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: vapid.privateKey,
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

export async function createVapidAuthorization(
  endpoint: string,
  vapid: VapidConfig,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  );

  const signingInput = `${header}.${claims}`;
  const key = await importVapidSigningKey(vapid);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      toArrayBuffer(encoder.encode(signingInput)),
    ),
  );

  return `vapid t=${signingInput}.${bytesToBase64Url(signature)}, k=${vapid.publicKey}`;
}

export interface PushSendResult {
  status: number;
  /** Prenumerationen finns inte längre och bör tas bort. */
  gone: boolean;
  error?: string;
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: string,
  vapid: VapidConfig,
  ttlSeconds = 60 * 60 * 24,
): Promise<PushSendResult> {
  const body = await encryptPushPayload(subscription, payload);
  const authorization = await createVapidAuthorization(subscription.endpoint, vapid);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "normal",
    },
    body: toArrayBuffer(body),
  });

  if (response.ok) return { status: response.status, gone: false };

  const gone = response.status === 404 || response.status === 410;
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    detail = "";
  }
  return { status: response.status, gone, error: detail || `HTTP ${response.status}` };
}
