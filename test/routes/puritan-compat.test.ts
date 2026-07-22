import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

// KINDE_DOMAIN is unset in the test env, so the auth middleware decodes (without
// verifying) any Bearer JWT that carries a `sub`. Build a minimal unsigned one.
const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const JWT = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: "test-user" })}.x`;
const authHeaders = {
  Authorization: `Bearer ${JWT}`,
  "Content-Type": "application/json",
};

async function seedPuritan() {
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS puritan_authors (id TEXT PRIMARY KEY, name TEXT NOT NULL, years TEXT)`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS puritan_works (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT, file_path TEXT, created_at TEXT)`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS search_tokens (id TEXT PRIMARY KEY, token TEXT NOT NULL, source_key TEXT, created_at TEXT)`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS puritan_work_tokens (work_id TEXT NOT NULL, token_id TEXT NOT NULL, match_count INTEGER NOT NULL DEFAULT 0, snippet TEXT)`,
  );
  for (const t of ["puritan_work_tokens", "search_tokens", "puritan_works", "puritan_authors"]) {
    await env.DB.exec(`DELETE FROM ${t}`);
  }
  await env.DB.exec(
    `INSERT INTO puritan_authors (id, name, years) VALUES ('a1', 'John Owen', '1616-1683')`,
  );
  await env.DB.exec(
    `INSERT INTO puritan_works (id, author_id, title, content, file_path) VALUES ('w1', 'a1', 'The Mortification of Sin', 'Real prose about Holy Scripture.', NULL)`,
  );
  await env.DB.exec(
    `INSERT INTO search_tokens (id, token) VALUES ('t1', 'Holy Scripture')`,
  );
  // The row that would crash 1.0.0: a NULL snippet against a non-null String field.
  await env.DB.exec(
    `INSERT INTO puritan_work_tokens (work_id, token_id, match_count, snippet) VALUES ('w1', 't1', 2, NULL)`,
  );
}

describe("Puritan legacy-contract compat", () => {
  beforeEach(seedPuritan);

  it("POST /api/puritan/search coalesces a NULL snippet to a non-null string", async () => {
    const res = await app.request(
      "/api/puritan/search",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ token: "Holy Scripture" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ author: string; snippet: string; match_count: number; title: string }>;
      search_type: string;
    };
    expect(body.search_type).toBe("token");
    expect(body.results).toHaveLength(1);
    const r = body.results[0];
    // The fields 1.0.0's SearchResult requires must be present and non-null.
    expect(r.snippet).toBe(""); // was NULL in D1 → would throw in kotlinx
    expect(typeof r.snippet).toBe("string");
    expect(r.author).toBe("John Owen");
    expect(r.match_count).toBe(2);
    expect(r.title).toBe("The Mortification of Sin");
  });

  it("GET /api/puritan/works/:id surfaces flattened author_name + years", async () => {
    const res = await app.request(
      "/api/puritan/works/w1",
      { headers: { Authorization: `Bearer ${JWT}` } },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      title: string;
      content: string;
      author_name: string | null;
      years: string | null;
    };
    expect(body.id).toBe("w1");
    expect(body.author_name).toBe("John Owen");
    expect(body.years).toBe("1616-1683");
    expect(body.content).toContain("Holy Scripture");
  });
});
