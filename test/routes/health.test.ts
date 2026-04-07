import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

describe("Health routes", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("parable-service-cloudflare");
    expect(body.timestamp).toBeDefined();
  });
});
