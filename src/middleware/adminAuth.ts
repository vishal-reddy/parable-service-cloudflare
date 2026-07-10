import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import type { Env } from "../types";

type AdminVariables = {
  userId: string;
  adminEmail: string;
};

/**
 * Admin-only auth for the trueconfessions.app dashboard.
 *
 * Requires a valid Kinde Bearer token (same issuer/audience as the mobile
 * apps), then restricts to the allowlist in the ADMIN_EMAILS / ADMIN_USER_IDS
 * environment variables (comma-separated). Email is taken from the token
 * claim when present, otherwise from Kinde's userinfo endpoint — so it works
 * regardless of whether the Kinde application maps email into access tokens.
 *
 * A 403 echoes the caller's own identity so the dashboard can show exactly
 * which email/id needs to be added to the allowlist.
 */
export const requireAdmin = createMiddleware<{
  Bindings: Env;
  Variables: AdminVariables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);

  let payload: jose.JWTPayload;
  try {
    const JWKS = jose.createRemoteJWKSet(
      new URL(`${c.env.KINDE_DOMAIN}/.well-known/jwks.json`)
    );
    ({ payload } = await jose.jwtVerify(token, JWKS, {
      issuer: c.env.KINDE_DOMAIN,
      audience: c.env.KINDE_AUDIENCE,
    }));
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const sub = payload.sub;
  if (!sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let email = typeof payload.email === "string" ? payload.email : undefined;
  if (!email) {
    try {
      const resp = await fetch(`${c.env.KINDE_DOMAIN}/oauth2/user_profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const profile = (await resp.json()) as {
          preferred_email?: string;
          email?: string;
        };
        email = profile.preferred_email ?? profile.email;
      }
    } catch {
      // userinfo unreachable — fall through to id-based check
    }
  }

  const allowedEmails = (c.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowedIds = (c.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isAdmin =
    (email != null && allowedEmails.includes(email.toLowerCase())) ||
    allowedIds.includes(sub);
  if (!isAdmin) {
    return c.json(
      { error: "Forbidden", email: email ?? null, userId: sub },
      403
    );
  }

  c.set("userId", sub);
  c.set("adminEmail", email ?? sub);
  await next();
});
