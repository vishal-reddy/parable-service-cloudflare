import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import type { Env } from "../types";

type AuthVariables = {
  userId: string;
};

/**
 * Kinde session + Bearer JWT auth middleware.
 * Checks session cookie first, then falls back to Authorization header.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  // 1. Try session cookie
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const sessionMatch = cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
      try {
        const decoded = JSON.parse(atob(sessionMatch[1]));
        if (decoded.access_token) {
          const claims = jose.decodeJwt(decoded.access_token);
          if (claims.sub) {
            c.set("userId", claims.sub);
            return next();
          }
        }
      } catch {
        // Invalid session, fall through to Bearer
      }
    }
  }

  // 2. Try Bearer token
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // Dev mode: skip validation if Kinde not configured
      if (!c.env.KINDE_DOMAIN) {
        const claims = jose.decodeJwt(token);
        if (claims.sub) {
          c.set("userId", claims.sub);
          return next();
        }
      }

      const JWKS = jose.createRemoteJWKSet(
        new URL(`${c.env.KINDE_DOMAIN}/.well-known/jwks.json`)
      );
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: c.env.KINDE_DOMAIN,
        audience: c.env.KINDE_AUDIENCE,
      });
      if (payload.sub) {
        c.set("userId", payload.sub);
        return next();
      }
    } catch (err) {
      console.error("JWT validation failed:", err);
    }
  }

  return c.json({ error: "Unauthorized" }, 401);
});
