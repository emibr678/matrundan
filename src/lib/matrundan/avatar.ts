import multiavatar from "../../vendor/multiavatar/index.js";

export type ProfileAvatarKind = "account" | "generated" | "emoji";

export const MULTIAVATAR_PREFIX = "multiavatar:v1:";

const generatedAvatarCache = new Map<string, string>();

export function createAvatarSeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function multiavatarImageToken(seed: string): string {
  const normalized = seed.trim();
  return normalized ? `${MULTIAVATAR_PREFIX}${normalized}` : "";
}

export function isMultiavatarImageToken(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(MULTIAVATAR_PREFIX));
}

export function avatarImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isMultiavatarImageToken(value)) return value;

  const seed = value.slice(MULTIAVATAR_PREFIX.length).trim();
  if (!seed) return null;

  const cached = generatedAvatarCache.get(seed);
  if (cached) return cached;

  const svg = multiavatar(seed);
  const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  if (generatedAvatarCache.size >= 200) {
    const oldest = generatedAvatarCache.keys().next().value;
    if (oldest) generatedAvatarCache.delete(oldest);
  }
  generatedAvatarCache.set(seed, dataUri);
  return dataUri;
}

export function normalizeProfileAvatarKind(value: unknown): ProfileAvatarKind {
  return value === "generated" || value === "emoji" ? value : "account";
}
