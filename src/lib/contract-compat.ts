/**
 * Backwards-compatibility shaping for the pinned first-release ("1.0.0") mobile
 * clients, so *all* Puritan traffic can be served from this Cloudflare Worker and
 * the legacy DigitalOcean backend — and its managed Postgres — can be retired.
 *
 * Gated by the LEGACY_CONTRACT_COMPAT env var (default "on"), so the behaviour is
 * reversible exactly the way DATABASE_BACKEND was on the DO service: flip it off
 * to serve only the CF-native shape.
 *
 * What the pinned client requires — from PuritanApiModels.kt, parsed by Ktor with
 * `Json { ignoreUnknownKeys = true; isLenient = true }`. Because unknown keys are
 * dropped, *extra* fields (file_path, search_type, the works/:id `author` object)
 * are harmless. Only non-null-required fields and type mismatches can break it:
 *
 *   SearchResult.snippet : non-null String — but D1 `puritan_work_tokens.snippet`
 *                          is nullable, so a null row would throw in kotlinx.
 *   SearchResult.author  : non-null String — D1 `puritan_authors.name` is NOT NULL,
 *                          but we coalesce defensively.
 *   Work                 : reads id/title/content plus author_name/author_id; the
 *                          CF `author` OBJECT is an unbound unknown key (dropped).
 *                          We additionally surface author_name + years so the
 *                          reader can show the author, matching/exceeding the DO
 *                          contract (which sent `author` as a string + `years`).
 */

export interface CompatEnv {
  LEGACY_CONTRACT_COMPAT?: string;
}

const DISABLED = new Set(["off", "false", "0", "no"]);

/** Legacy-contract shaping is ON unless explicitly disabled. */
export function legacyCompatEnabled(env: CompatEnv): boolean {
  const v = (env.LEGACY_CONTRACT_COMPAT ?? "on").trim().toLowerCase();
  return !DISABLED.has(v);
}

/**
 * Strip source-file leakage and TODO/checklist noise from stub markdown, mirroring
 * the DO service's `scrub-source-paths` so snippets and work content read
 * identically across the two backends. A no-op on already-clean prose.
 */
export function scrubSourcePaths(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/^Source DOCX:\s*`[^`]+`\s*$/gm, "")
    .replace(
      /^Status:\s*TODO manual conversion and theological proofread\.\s*$/gm,
      "",
    )
    .replace(/^## Conversion Checklist\n(?:- .*\n?)*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A search result row as the token / LIKE queries produce it. */
export interface SearchRow {
  work_id: string;
  title: string;
  file_path?: string | null;
  author: string | null;
  years: string | null;
  match_count: number | null;
  snippet: string | null;
  [k: string]: unknown;
}

/**
 * Guarantee every field the pinned client's `SearchResult` requires is a non-null
 * value of the right type, and scrub snippet leakage. Extra keys pass through
 * untouched — the client ignores them.
 */
export function toLegacySearchResult(row: SearchRow): SearchRow {
  return {
    ...row,
    author: row.author ?? "",
    match_count: row.match_count ?? 0,
    snippet: scrubSourcePaths(row.snippet),
  };
}

/** Minimal author shape read off the joined author row. */
export interface AuthorLike {
  name?: string | null;
  years?: string | null;
}

/**
 * Extra top-level fields to merge into a `GET /works/:id` response under compat:
 * a flattened `author_name` + `years` so the reader can display the author even
 * though the pinned `Work` model never binds the CF `author` object.
 */
export function legacyWorkFields(
  author: AuthorLike | null | undefined,
): { author_name: string | null; years: string | null } {
  return {
    author_name: author?.name ?? null,
    years: author?.years ?? null,
  };
}
