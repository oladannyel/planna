const MAX_BASE_LENGTH = 40;
const FALLBACK_BASE = "workspace";

/**
 * Convert arbitrary text into a URL-safe slug base:
 * lowercase, alphanumeric words joined by single hyphens, trimmed.
 * Falls back to "workspace" when nothing usable remains.
 */
export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-$/g, "");

  return cleaned.length > 0 ? cleaned : FALLBACK_BASE;
}

/** Compose a unique workspace slug from a base and a short uniqueness token. */
export function buildSlug(base: string, token: string): string {
  return `${slugify(base)}-${token}`;
}

/** Short, lowercase, collision-resistant token derived from a UUID. */
export function slugToken(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 6).toLowerCase();
}
