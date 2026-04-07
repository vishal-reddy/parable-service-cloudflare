import { Hono } from "hono";
import type { Env } from "../types";

/**
 * Feature toggle configuration.
 * Each feature specifies min app version per platform.
 * Features default to disabled if not listed.
 */
const featureConfig: Record<
  string,
  { enabled: boolean; minAndroid?: number; minIos?: number }
> = {
  "puritan-search": { enabled: true, minAndroid: 6, minIos: 2 },
  authentication: { enabled: true, minAndroid: 6, minIos: 2 },
  "cloudflare-backend": { enabled: true, minAndroid: 8, minIos: 8 },
};

function isFeatureEnabled(
  key: string,
  platform: string | undefined,
  appVersion: number
): boolean {
  const feature = featureConfig[key];
  if (!feature || !feature.enabled) return false;

  if (platform === "android" && feature.minAndroid != null) {
    return appVersion >= feature.minAndroid;
  }
  if (platform === "ios" && feature.minIos != null) {
    return appVersion >= feature.minIos;
  }
  // Unknown platform — enable if no version requirements
  return feature.minAndroid == null && feature.minIos == null;
}

export const featuresRoutes = new Hono<{ Bindings: Env }>();

// GET /api/features — public, no auth required
featuresRoutes.get("/", (c) => {
  const platform = c.req.query("platform");
  const appVersion = parseInt(c.req.query("version") ?? "1", 10) || 1;

  const features: Record<string, boolean> = {};
  for (const key of Object.keys(featureConfig)) {
    features[key] = isFeatureEnabled(key, platform, appVersion);
  }

  return c.json({ features, timestamp: new Date().toISOString() });
});
