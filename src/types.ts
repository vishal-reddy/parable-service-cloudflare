import { z } from "zod/v4";

// ─── Env Bindings ──────────────────────────────────────────────────────────
export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  KINDE_DOMAIN: string;
  KINDE_CLIENT_ID: string;
  KINDE_CLIENT_SECRET: string;
  KINDE_REDIRECT_URI: string;
  KINDE_LOGOUT_REDIRECT_URI: string;
  KINDE_AUDIENCE: string;
  WEATHER_API_BASE_URL: string;
  SESSION_SECRET: string;
}

// ─── Story Schemas ─────────────────────────────────────────────────────────
export const BeatSchema = z.object({
  description: z.string(),
  type: z.enum([
    "opening-hook",
    "inciting-incident",
    "point-of-no-return",
    "new-world",
    "crossroads",
    "big-gloom",
    "aftermath",
    "plan",
    "new-equilibrium",
    "none",
  ]),
  position: z.number().int(),
});

export const ActSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(["first", "second", "third", "none"]),
  position: z.number().int(),
  beats: z.array(BeatSchema).optional(),
});

export const CharacterSchema = z.object({
  name: z.string(),
  age: z.number().int().optional(),
  gender: z.enum(["male", "female", "unknown"]).default("unknown"),
  build: z
    .enum(["slim", "average", "muscular", "plump", "unknown"])
    .default("unknown"),
  height: z
    .enum(["mini", "short", "average", "tall", "giant", "unknown"])
    .default("unknown"),
  temperament_major: z
    .enum(["sanguine", "melancholic", "choleric", "phlegmatic", "unknown"])
    .default("unknown"),
  temperament_minor: z
    .enum(["sanguine", "melancholic", "choleric", "phlegmatic", "unknown"])
    .default("unknown"),
});

export const LocationSchema = z.object({
  title: z.string(),
  resemblance: z.string().optional(),
});

export const CreateStorySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  acts: z.array(ActSchema).optional(),
  characters: z.array(CharacterSchema).optional(),
  locations: z.array(LocationSchema).optional(),
});

export const UpdateStorySchema = CreateStorySchema.partial();

// ─── Puritan Schemas ───────────────────────────────────────────────────────
export const SearchByTokenSchema = z.object({
  token: z.string().min(1),
});

// ─── Assessment Schemas ────────────────────────────────────────────────────
export const PromptEngineeringScoreSchema = z.object({
  overall_score: z.number().min(0).max(10),
  clarity_score: z.number().min(0).max(10),
  specificity_score: z.number().min(0).max(10),
  context_setting_score: z.number().min(0).max(10),
  iterative_refinement_score: z.number().min(0).max(10),
  conversation_quality_score: z.number().min(0).max(10),
  analysis: z.string().optional(),
  recommendations: z.string().optional(),
});

export const EthicsScoreSchema = z.object({
  overall_score: z.number().min(0).max(10),
  misuse_score: z.number().min(0).max(10),
  bias_score: z.number().min(0).max(10),
  harm_score: z.number().min(0).max(10),
  epistemology_score: z.number().min(0).max(10),
  virtue_alignment_score: z.number().min(0).max(10),
  extra_categories: z.record(z.string(), z.unknown()).optional(),
  analysis: z.string().optional(),
  recommendations: z.string().optional(),
});

export const SubmitAssessmentSchema = z.object({
  tool: z.string().min(1).max(50),
  session_id: z.string().min(1).max(255),
  project_path: z.string().optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  message_count: z.number().int().optional(),
  summary: z.string().optional(),
  prompt_engineering_scores: PromptEngineeringScoreSchema.optional(),
  ethics_scores: EthicsScoreSchema.optional(),
});

export const BatchSubmitAssessmentSchema = z.object({
  assessments: z.array(SubmitAssessmentSchema),
});

// ─── MCP Schemas ───────────────────────────────────────────────────────────
export const McpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ─── Pagination ────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
