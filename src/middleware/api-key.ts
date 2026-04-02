import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { api_keys } from "../db/schema";
import type { Env } from "../types";

type ApiKeyVariables = {
  apiKeyUserId: string;
};

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 API key auth for assessment daemon endpoints.
 */
export const requireApiKey = createMiddleware<{
  Bindings: Env;
  Variables: ApiKeyVariables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing API key" }, 401);
  }

  const token = authHeader.slice(7);
  const keyHash = await sha256(token);

  const db = drizzle(c.env.DB);
  const results = await db
    .select()
    .from(api_keys)
    .where(eq(api_keys.key_hash, keyHash))
    .limit(1);

  if (results.length === 0) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  const key = results[0];
  if (key.revoked_at) {
    return c.json({ error: "API key revoked" }, 401);
  }

  // Update last_used_at
  await db
    .update(api_keys)
    .set({ last_used_at: new Date().toISOString() })
    .where(eq(api_keys.id, key.id));

  c.set("apiKeyUserId", key.user_id);
  return next();
});
