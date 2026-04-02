import { describe, it, expect, beforeEach } from "vitest";
import app from "../../src/index";

describe("Stories routes", () => {
  let env: { DB: D1Database; [key: string]: unknown };

  beforeEach(async () => {
    env = getMiniflareBindings() as { DB: D1Database; [key: string]: unknown };
    await (env.DB as D1Database).exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS acts (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'none',
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS beats (
        id TEXT PRIMARY KEY,
        act_id TEXT NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'none',
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        age INTEGER,
        gender TEXT NOT NULL DEFAULT 'unknown',
        build TEXT NOT NULL DEFAULT 'unknown',
        height TEXT NOT NULL DEFAULT 'unknown',
        temperament_major TEXT NOT NULL DEFAULT 'unknown',
        temperament_minor TEXT NOT NULL DEFAULT 'unknown'
      );
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        resemblance TEXT
      );
      DELETE FROM stories;
    `);
  });

  it("GET /api/stories returns empty list", async () => {
    const res = await app.request("/api/stories", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toEqual([]);
  });

  it("POST /api/stories creates a story", async () => {
    const res = await app.request(
      "/api/stories",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Story",
          description: "A test story",
          characters: [{ name: "Hero", gender: "male" }],
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });

  it("GET /api/stories/:id returns story with nested data", async () => {
    // Create story first
    const createRes = await app.request(
      "/api/stories",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Nested Story",
          acts: [
            {
              title: "Act One",
              type: "first",
              position: 0,
              beats: [
                {
                  description: "Opening scene",
                  type: "opening-hook",
                  position: 0,
                },
              ],
            },
          ],
          characters: [{ name: "Protagonist" }],
          locations: [{ title: "Castle" }],
        }),
      },
      env
    );
    const { id } = await createRes.json();

    const res = await app.request(`/api/stories/${id}`, {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Nested Story");
    expect(body.acts).toHaveLength(1);
    expect(body.acts[0].beats).toHaveLength(1);
    expect(body.characters).toHaveLength(1);
    expect(body.locations).toHaveLength(1);
  });

  it("DELETE /api/stories/:id removes story", async () => {
    const createRes = await app.request(
      "/api/stories",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "To Delete" }),
      },
      env
    );
    const { id } = await createRes.json();

    const delRes = await app.request(
      `/api/stories/${id}`,
      { method: "DELETE" },
      env
    );
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/api/stories/${id}`, {}, env);
    expect(getRes.status).toBe(404);
  });
});
