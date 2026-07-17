import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc } from "drizzle-orm";
import { translation_feedback } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { TranslationFeedbackSchema, PaginationSchema } from "../types";
import type { Env } from "../types";
import { createTranslationFeedbackIssue } from "../lib/github";

export const translationRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/translations/feedback
 * Public endpoint — no auth required so any app user can submit feedback
 * regardless of sign-in state.
 */
translationRoutes.post("/feedback", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = TranslationFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 422);
  }

  const db = drizzle(c.env.DB);
  const [row] = await db
    .insert(translation_feedback)
    .values({
      language: parsed.data.language,
      screen: parsed.data.screen ?? null,
      note: parsed.data.note ?? null,
      correction: parsed.data.correction ?? null,
      platform: parsed.data.platform ?? null,
      app_version: parsed.data.app_version ?? null,
      user_email: parsed.data.user_email ?? null,
    })
    .returning({ id: translation_feedback.id });

  // Open a GitHub issue for triage (non-blocking: runs after the response, and
  // never affects whether the submission succeeds — see createTranslationFeedbackIssue).
  c.executionCtx.waitUntil(
    createTranslationFeedbackIssue(c.env, {
      id: row.id,
      language: parsed.data.language,
      screen: parsed.data.screen,
      note: parsed.data.note,
      correction: parsed.data.correction,
      platform: parsed.data.platform,
      app_version: parsed.data.app_version,
    }),
  );

  return c.json({ success: true, id: row.id }, 201);
});

/**
 * GET /api/translations/feedback
 * Admin-only: list all feedback entries, newest first.
 */
translationRoutes.get("/feedback", requireAuth, async (c) => {
  const { limit, offset } = PaginationSchema.parse(c.req.query());
  const db = drizzle(c.env.DB);

  const rows = await db
    .select()
    .from(translation_feedback)
    .orderBy(desc(translation_feedback.created_at))
    .limit(limit)
    .offset(offset);

  return c.json({ feedback: rows, limit, offset });
});
