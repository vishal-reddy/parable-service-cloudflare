import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
  assessments,
  conversations,
  prompt_engineering_scores,
  ethics_scores,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireApiKey } from "../middleware/api-key";
import {
  SubmitAssessmentSchema,
  BatchSubmitAssessmentSchema,
  PaginationSchema,
} from "../types";
import type { Env } from "../types";

export const assessmentsRoutes = new Hono<{ Bindings: Env }>();

// ─── API Key protected: submit assessment ──────────────────────────────────

assessmentsRoutes.post("/", requireApiKey, async (c) => {
  const body = await c.req.json();
  const validated = SubmitAssessmentSchema.parse(body);
  const userId = c.get("apiKeyUserId");
  const db = drizzle(c.env.DB);

  const result = await createAssessment(db, c.env.DB, userId, validated);
  return c.json(result, 201);
});

assessmentsRoutes.post("/batch", requireApiKey, async (c) => {
  const body = await c.req.json();
  const { assessments: items } = BatchSubmitAssessmentSchema.parse(body);
  const userId = c.get("apiKeyUserId");
  const db = drizzle(c.env.DB);

  const results = [];
  for (const item of items) {
    const result = await createAssessment(db, c.env.DB, userId, item);
    results.push(result);
  }

  return c.json({ assessments: results, count: results.length }, 201);
});

// ─── Kinde auth protected: list/get assessments ────────────────────────────

assessmentsRoutes.get("/", requireAuth, async (c) => {
  const { limit, offset } = PaginationSchema.parse(c.req.query());
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const results = await db
    .select()
    .from(assessments)
    .innerJoin(conversations, eq(assessments.conversation_id, conversations.id))
    .where(eq(conversations.user_id, userId))
    .limit(limit)
    .offset(offset)
    .orderBy(assessments.created_at);

  return c.json({
    assessments: results.map((r) => ({
      ...r.assessments,
      conversation: r.conversations,
    })),
    limit,
    offset,
  });
});

assessmentsRoutes.get("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [assessment] = await db
    .select()
    .from(assessments)
    .innerJoin(conversations, eq(assessments.conversation_id, conversations.id))
    .where(and(eq(assessments.id, id), eq(conversations.user_id, userId)))
    .limit(1);

  if (!assessment) {
    return c.json({ error: "Assessment not found" }, 404);
  }

  const [peScores] = await db
    .select()
    .from(prompt_engineering_scores)
    .where(eq(prompt_engineering_scores.assessment_id, id))
    .limit(1);

  const [ethScores] = await db
    .select()
    .from(ethics_scores)
    .where(eq(ethics_scores.assessment_id, id))
    .limit(1);

  return c.json({
    ...assessment.assessments,
    conversation: assessment.conversations,
    prompt_engineering_scores: peScores ?? null,
    ethics_scores: ethScores
      ? {
          ...ethScores,
          extra_categories: ethScores.extra_categories
            ? JSON.parse(ethScores.extra_categories)
            : null,
        }
      : null,
  });
});

// ─── Helper ────────────────────────────────────────────────────────────────

async function createAssessment(
  db: ReturnType<typeof drizzle>,
  d1: D1Database,
  userId: string,
  data: ReturnType<typeof SubmitAssessmentSchema.parse>
) {
  const now = new Date().toISOString();

  // Upsert conversation
  const existingConversations = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.user_id, userId),
        eq(conversations.tool, data.tool),
        eq(conversations.session_id, data.session_id)
      )
    )
    .limit(1);

  let conversationId: string;
  if (existingConversations.length > 0) {
    conversationId = existingConversations[0].id;
    await db
      .update(conversations)
      .set({
        project_path: data.project_path ?? null,
        ended_at: data.ended_at ?? null,
        message_count: data.message_count ?? null,
        updated_at: now,
      })
      .where(eq(conversations.id, conversationId));
  } else {
    conversationId = crypto.randomUUID();
    await db.insert(conversations).values({
      id: conversationId,
      user_id: userId,
      tool: data.tool,
      session_id: data.session_id,
      project_path: data.project_path ?? null,
      started_at: data.started_at ?? null,
      ended_at: data.ended_at ?? null,
      message_count: data.message_count ?? null,
      created_at: now,
      updated_at: now,
    });
  }

  // Create assessment
  const assessmentId = crypto.randomUUID();
  await db.insert(assessments).values({
    id: assessmentId,
    conversation_id: conversationId,
    status: "complete",
    summary: data.summary ?? null,
    assessed_at: now,
    created_at: now,
    updated_at: now,
  });

  // Insert scores
  if (data.prompt_engineering_scores) {
    await db.insert(prompt_engineering_scores).values({
      id: crypto.randomUUID(),
      assessment_id: assessmentId,
      ...data.prompt_engineering_scores,
      analysis: data.prompt_engineering_scores.analysis ?? null,
      recommendations: data.prompt_engineering_scores.recommendations ?? null,
      created_at: now,
    });
  }

  if (data.ethics_scores) {
    await db.insert(ethics_scores).values({
      id: crypto.randomUUID(),
      assessment_id: assessmentId,
      ...data.ethics_scores,
      extra_categories: data.ethics_scores.extra_categories
        ? JSON.stringify(data.ethics_scores.extra_categories)
        : null,
      analysis: data.ethics_scores.analysis ?? null,
      recommendations: data.ethics_scores.recommendations ?? null,
      created_at: now,
    });
  }

  return { id: assessmentId, conversation_id: conversationId };
}
