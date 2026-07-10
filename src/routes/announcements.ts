import { Hono } from "hono";
import type { Env } from "../types";

/**
 * App-wide announcements, shown in the apps' Settings → Announcements screen.
 *
 * Read-only over HTTP; rows are managed with the wrangler CLI so publishing
 * an announcement never needs a code deploy. Prod and test have separate D1
 * databases, so an announcement can be rehearsed on test first:
 *
 *   wrangler d1 execute parable-db-test --remote --env test \
 *     --command "INSERT INTO announcements (title, body) VALUES ('…', '…')"
 *   wrangler d1 execute parable-db --remote \
 *     --command "INSERT INTO announcements (title, body) VALUES ('…', '…')"
 */
export const announcementsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/announcements — public, no auth required
announcementsRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, created_at AS createdAt
       FROM announcements
      ORDER BY id DESC
      LIMIT 50`
  ).all();

  return c.json({
    announcements: results ?? [],
    timestamp: new Date().toISOString(),
  });
});
