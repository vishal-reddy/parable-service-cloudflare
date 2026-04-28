import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { storiesRoutes } from "./routes/stories";
import { puritanRoutes } from "./routes/puritan";
import { assessmentsRoutes } from "./routes/assessments";
import { weatherRoutes } from "./routes/weather";
import { mcpRoutes } from "./routes/mcp";
import { featuresRoutes } from "./routes/features";
import { translationRoutes } from "./routes/translation";
import { indexPage } from "./views/index";

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ─────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());
app.use("*", secureHeaders());

// ─── HTML Pages ────────────────────────────────────────────────────────────
app.get("/", indexPage);

// ─── Routes ────────────────────────────────────────────────────────────────
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/api/stories", storiesRoutes);
app.route("/api/puritan", puritanRoutes);
app.route("/api/assessments", assessmentsRoutes);
app.route("/api/weather", weatherRoutes);
app.route("/api/features", featuresRoutes);
app.route("/api/translations", translationRoutes);
app.route("/", mcpRoutes);

// ─── Global Error Handler ──────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: "Internal server error", message: err.message },
    500
  );
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
