import { Hono } from "hono";
import type { Env } from "../types";

export const authRoutes = new Hono<{ Bindings: Env }>();

function buildKindeUrl(
  env: Env,
  path: string,
  extraParams?: Record<string, string>
): string {
  const params = new URLSearchParams({
    client_id: env.KINDE_CLIENT_ID,
    redirect_uri: env.KINDE_REDIRECT_URI,
    response_type: "code",
    scope: "openid profile email",
    audience: env.KINDE_AUDIENCE,
    ...extraParams,
  });
  return `${env.KINDE_DOMAIN}${path}?${params.toString()}`;
}

authRoutes.get("/login", (c) => {
  const url = buildKindeUrl(c.env, "/oauth2/auth");
  return c.redirect(url);
});

authRoutes.get("/signup", (c) => {
  const url = buildKindeUrl(c.env, "/oauth2/auth", {
    screen_hint: "registration",
  });
  return c.redirect(url);
});

authRoutes.get("/logout", (c) => {
  const params = new URLSearchParams({
    redirect: c.env.KINDE_LOGOUT_REDIRECT_URI,
  });
  // Clear session cookie
  c.header(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );
  return c.redirect(`${c.env.KINDE_DOMAIN}/logout?${params.toString()}`);
});

authRoutes.get("/kinde/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      `${c.env.KINDE_DOMAIN}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: c.env.KINDE_CLIENT_ID,
          client_secret: c.env.KINDE_CLIENT_SECRET,
          code,
          redirect_uri: c.env.KINDE_REDIRECT_URI,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return c.json({ error: "Authentication failed" }, 401);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token?: string;
    };

    // Encode session data as base64 JSON in cookie
    const sessionData = JSON.stringify({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
    });
    const encoded = btoa(sessionData);

    c.header(
      "Set-Cookie",
      `session=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    return c.redirect("/");
  } catch (err) {
    console.error("Kinde callback error:", err);
    return c.json({ error: "Authentication failed" }, 500);
  }
});
