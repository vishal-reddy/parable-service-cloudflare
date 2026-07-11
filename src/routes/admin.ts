import { Hono } from "hono";
import { z } from "zod/v4";
import type { Env } from "../types";
import { requireAdmin } from "../middleware/adminAuth";
import {
  FEATURES_KEY,
  UPGRADE_KEY,
  getConfigJson,
  putConfigJson,
  type FeatureOverrides,
  type UpgradeOverrides,
} from "../db/appConfig";
import { featureDefaults, upgradeDefaults } from "./features";

/**
 * Admin API for the trueconfessions.app dashboard. Everything here requires
 * a Kinde token whose email/id is on the ADMIN_EMAILS / ADMIN_USER_IDS
 * allowlist (see middleware/adminAuth.ts). Each environment (prod/test) is
 * its own worker + D1 database, so the dashboard targets an environment by
 * calling that environment's host.
 */
export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use("*", requireAdmin);

// ── Overview ────────────────────────────────────────────────────────────────

// GET /api/admin/overview — everything the dashboard renders in one call
adminRoutes.get("/overview", async (c) => {
  const [featureOverrides, upgradeOverrides, announcements] = await Promise.all([
    getConfigJson<FeatureOverrides>(c.env.DB, FEATURES_KEY),
    getConfigJson<UpgradeOverrides>(c.env.DB, UPGRADE_KEY),
    c.env.DB.prepare(
      `SELECT id, title, body, created_at AS createdAt
         FROM announcements
      ORDER BY created_at DESC, id DESC
      LIMIT 100`
    ).all(),
  ]);

  return c.json({
    environment: c.env.ENVIRONMENT,
    features: {
      defaults: featureDefaults(c.env),
      overrides: featureOverrides ?? {},
    },
    upgrade: {
      defaults: upgradeDefaults(c.env),
      overrides: upgradeOverrides ?? {},
    },
    announcements: announcements.results ?? [],
  });
});

// ── Feature toggle overrides ───────────────────────────────────────────────

const FeatureOverridesSchema = z.record(z.string(), z.boolean().nullable());

// PUT /api/admin/features — merge overrides; null clears a key back to default
adminRoutes.put("/features", async (c) => {
  const parsed = FeatureOverridesSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const current =
    (await getConfigJson<FeatureOverrides>(c.env.DB, FEATURES_KEY)) ?? {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === null) delete current[key];
    else current[key] = value;
  }
  await putConfigJson(c.env.DB, FEATURES_KEY, current);
  return c.json({ overrides: current });
});

// ── Upgrade (minimum version) overrides ────────────────────────────────────

const UpgradePlatformSchema = z
  .object({
    minVersion: z.number().int().min(0),
    recommendedVersion: z.number().int().min(0).optional(),
    storeUrl: z.string().url(),
  })
  .nullable();
const UpgradeOverridesSchema = z.object({
  android: UpgradePlatformSchema.optional(),
  ios: UpgradePlatformSchema.optional(),
});

// PUT /api/admin/upgrade — set per-platform min version; null clears to default
adminRoutes.put("/upgrade", async (c) => {
  const parsed = UpgradeOverridesSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const current =
    (await getConfigJson<UpgradeOverrides>(c.env.DB, UPGRADE_KEY)) ?? {};
  for (const platform of ["android", "ios"] as const) {
    const value = parsed.data[platform];
    if (value === undefined) continue;
    if (value === null) delete current[platform];
    else current[platform] = value;
  }
  await putConfigJson(c.env.DB, UPGRADE_KEY, current);
  return c.json({ overrides: current });
});

// ── Announcements CRUD ─────────────────────────────────────────────────────

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

// POST /api/admin/announcements
adminRoutes.post("/announcements", async (c) => {
  const parsed = AnnouncementSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const result = await c.env.DB.prepare(
    "INSERT INTO announcements (title, body) VALUES (?, ?) RETURNING id, title, body, created_at AS createdAt"
  )
    .bind(parsed.data.title, parsed.data.body)
    .first();
  return c.json({ announcement: result }, 201);
});

// PUT /api/admin/announcements/:id
adminRoutes.put("/announcements/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const parsed = AnnouncementSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const result = await c.env.DB.prepare(
    "UPDATE announcements SET title = ?, body = ? WHERE id = ? RETURNING id, title, body, created_at AS createdAt"
  )
    .bind(parsed.data.title, parsed.data.body, id)
    .first();
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json({ announcement: result });
});

// DELETE /api/admin/announcements/:id
adminRoutes.delete("/announcements/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  await c.env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
  return c.json({ deleted: id });
});
