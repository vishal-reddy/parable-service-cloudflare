import { Hono } from "hono";
import type { Env } from "../types";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "parable-service-cloudflare",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").run();
    return c.json({
      status: "ok",
      service: "parable-service-cloudflare",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json(
      {
        status: "error",
        service: "parable-service-cloudflare",
        database: "disconnected",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});
