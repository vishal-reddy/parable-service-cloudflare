import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { puritan_authors, puritan_works, search_tokens } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { SearchByTokenSchema, PaginationSchema } from "../types";
import type { Env } from "../types";

export const puritanRoutes = new Hono<{ Bindings: Env }>();

// All puritan routes require auth
puritanRoutes.use("*", requireAuth);

// List all search tokens
puritanRoutes.get("/tokens", async (c) => {
  const db = drizzle(c.env.DB);
  const tokens = await db.select().from(search_tokens).orderBy(search_tokens.token);
  return c.json({ tokens });
});

// Search works by token (with FTS5 fallback)
puritanRoutes.post("/search", async (c) => {
  const body = await c.req.json();
  const { token } = SearchByTokenSchema.parse(body);
  const { limit, offset } = PaginationSchema.parse(c.req.query());

  const db = drizzle(c.env.DB);

  // First: try token-based search via junction table
  const tokenResults = await c.env.DB.prepare(`
    SELECT pw.id, pw.title, pw.file_path, pa.name as author_name, pa.years as author_years,
           pwt.match_count, pwt.snippet
    FROM puritan_work_tokens pwt
    JOIN puritan_works pw ON pwt.work_id = pw.id
    JOIN puritan_authors pa ON pw.author_id = pa.id
    JOIN search_tokens st ON pwt.token_id = st.id
    WHERE st.token = ?
    ORDER BY pwt.match_count DESC
    LIMIT ? OFFSET ?
  `)
    .bind(token, limit, offset)
    .all();

  if (tokenResults.results.length > 0) {
    return c.json({ results: tokenResults.results, search_type: "token" });
  }

  // Fallback: FTS5 full-text search
  const ftsResults = await c.env.DB.prepare(`
    SELECT pw.id, pw.title, pw.file_path, pa.name as author_name, pa.years as author_years,
           snippet(puritan_works_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
    FROM puritan_works_fts
    JOIN puritan_works pw ON puritan_works_fts.rowid = pw.rowid
    JOIN puritan_authors pa ON pw.author_id = pa.id
    WHERE puritan_works_fts MATCH ?
    ORDER BY rank
    LIMIT ? OFFSET ?
  `)
    .bind(token, limit, offset)
    .all();

  return c.json({ results: ftsResults.results, search_type: "fulltext" });
});

// Get work by ID
puritanRoutes.get("/works/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [work] = await db
    .select()
    .from(puritan_works)
    .where(eq(puritan_works.id, id))
    .limit(1);

  if (!work) {
    return c.json({ error: "Work not found" }, 404);
  }

  const [author] = await db
    .select()
    .from(puritan_authors)
    .where(eq(puritan_authors.id, work.author_id))
    .limit(1);

  return c.json({ ...work, author });
});

// List all authors
puritanRoutes.get("/authors", async (c) => {
  const db = drizzle(c.env.DB);
  const authors = await db
    .select()
    .from(puritan_authors)
    .orderBy(puritan_authors.name);
  return c.json({ authors });
});

// List works by author
puritanRoutes.get("/authors/:id/works", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [author] = await db
    .select()
    .from(puritan_authors)
    .where(eq(puritan_authors.id, id))
    .limit(1);

  if (!author) {
    return c.json({ error: "Author not found" }, 404);
  }

  const works = await db
    .select({
      id: puritan_works.id,
      title: puritan_works.title,
      file_path: puritan_works.file_path,
      created_at: puritan_works.created_at,
    })
    .from(puritan_works)
    .where(eq(puritan_works.author_id, id))
    .orderBy(puritan_works.title);

  return c.json({ author, works });
});
