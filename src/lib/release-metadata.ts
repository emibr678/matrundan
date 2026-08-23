const candidate = import.meta.env.VITE_MATRUNDAN_RELEASE_SHA?.trim() ?? "";

export const RELEASE_SHA = /^[0-9a-f]{40}$/i.test(candidate) ? candidate.toLowerCase() : "unknown";
