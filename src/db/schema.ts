import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Stories Domain ────────────────────────────────────────────────────────

export const stories = sqliteTable("stories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const acts = sqliteTable("acts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  story_id: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("none"),
  position: integer("position").notNull().default(0),
});

export const beats = sqliteTable("beats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  act_id: text("act_id")
    .notNull()
    .references(() => acts.id, { onDelete: "cascade" }),
  description: text("description"),
  type: text("type").notNull().default("none"),
  position: integer("position").notNull().default(0),
});

export const characters = sqliteTable("characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  story_id: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age"),
  gender: text("gender").notNull().default("unknown"),
  build: text("build").notNull().default("unknown"),
  height: text("height").notNull().default("unknown"),
  temperament_major: text("temperament_major").notNull().default("unknown"),
  temperament_minor: text("temperament_minor").notNull().default("unknown"),
});

export const locations = sqliteTable("locations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  story_id: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  resemblance: text("resemblance"),
});

// ─── Puritan Library Domain ────────────────────────────────────────────────

export const puritan_authors = sqliteTable("puritan_authors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  years: text("years"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const puritan_works = sqliteTable("puritan_works", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  author_id: text("author_id")
    .notNull()
    .references(() => puritan_authors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  file_path: text("file_path"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const search_tokens = sqliteTable("search_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  source_key: text("source_key"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const puritan_work_tokens = sqliteTable("puritan_work_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  work_id: text("work_id")
    .notNull()
    .references(() => puritan_works.id, { onDelete: "cascade" }),
  token_id: text("token_id")
    .notNull()
    .references(() => search_tokens.id, { onDelete: "cascade" }),
  match_count: integer("match_count").notNull().default(0),
  snippet: text("snippet"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Assessment Domain ─────────────────────────────────────────────────────

export const api_keys = sqliteTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  key_hash: text("key_hash").notNull(),
  name: text("name"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  last_used_at: text("last_used_at"),
  revoked_at: text("revoked_at"),
});

export const conversations = sqliteTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  tool: text("tool").notNull(),
  session_id: text("session_id").notNull(),
  project_path: text("project_path"),
  started_at: text("started_at"),
  ended_at: text("ended_at"),
  message_count: integer("message_count"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const assessments = sqliteTable("assessments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversation_id: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  summary: text("summary"),
  assessed_at: text("assessed_at"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const prompt_engineering_scores = sqliteTable(
  "prompt_engineering_scores",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    assessment_id: text("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    overall_score: real("overall_score"),
    clarity_score: real("clarity_score"),
    specificity_score: real("specificity_score"),
    context_setting_score: real("context_setting_score"),
    iterative_refinement_score: real("iterative_refinement_score"),
    conversation_quality_score: real("conversation_quality_score"),
    analysis: text("analysis"),
    recommendations: text("recommendations"),
    created_at: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  }
);

export const ethics_scores = sqliteTable("ethics_scores", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assessment_id: text("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  overall_score: real("overall_score"),
  misuse_score: real("misuse_score"),
  bias_score: real("bias_score"),
  harm_score: real("harm_score"),
  epistemology_score: real("epistemology_score"),
  virtue_alignment_score: real("virtue_alignment_score"),
  extra_categories: text("extra_categories"), // JSON string
  analysis: text("analysis"),
  recommendations: text("recommendations"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Weather Domain ────────────────────────────────────────────────────────

export const weather_forecast = sqliteTable("weather_forecast", {
  time: text("time").primaryKey(),
  temperature: text("temperature"),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Translation Feedback Domain ───────────────────────────────────────────

export const translation_feedback = sqliteTable("translation_feedback", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  language: text("language").notNull(),
  screen: text("screen"),
  note: text("note"),
  correction: text("correction"),
  platform: text("platform"),
  app_version: text("app_version"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
