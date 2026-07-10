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

/**
 * Minimum supported app version per platform. Builds below `minVersion`
 * (versionCode on Android, CFBundleVersion on iOS — the same numbers the
 * app already sends as `version`) are told to upgrade via the `upgrade`
 * object in the response, and show a blocking upgrade screen.
 *
 * Raise these numbers (and deploy) to force an upgrade. The test
 * environment carries its own values so the gate can be exercised on
 * dev/PR builds before ever touching production.
 */
const upgradeConfig: Record<
  string,
  Record<string, { minVersion: number; storeUrl: string }>
> = {
  production: {
    android: {
      minVersion: 1,
      storeUrl:
        "https://play.google.com/store/apps/details?id=org.irbsseminary.trueconfessions",
    },
    ios: { minVersion: 1, storeUrl: "https://apps.apple.com/app/id6741652053" },
  },
  test: {
    android: {
      minVersion: 1,
      storeUrl:
        "https://play.google.com/store/apps/details?id=org.irbsseminary.trueconfessions",
    },
    ios: { minVersion: 1, storeUrl: "https://apps.apple.com/app/id6741652053" },
  },
};

export const featuresRoutes = new Hono<{ Bindings: Env }>();

// GET /api/features — public, no auth required
featuresRoutes.get("/", (c) => {
  const platform = c.req.query("platform");
  const appVersion = parseInt(c.req.query("version") ?? "1", 10) || 1;

  const features: Record<string, boolean> = {};
  for (const key of Object.keys(featureConfig)) {
    features[key] = isFeatureEnabled(key, platform, appVersion);
  }

  // Source-comparison (confession diffs) is environment-gated rather than
  // version-gated: ON in the test environment, OFF in production. This is what
  // lets dev/PR app builds (which talk to the test backend) show the feature
  // while production builds (talking to prod) keep it hidden.
  features["source-comparison"] = c.env.ENVIRONMENT === "test";

  // Puritan full-content reader + search pagination — env-gated the same way:
  // ON in test (dev/PR app builds) so it can be validated before production.
  features["puritan-full-reader"] = c.env.ENVIRONMENT === "test";

  // Per-platform minimum-version gate. Omitted for unknown platforms so old
  // clients (which ignore unknown JSON fields) and non-app callers are
  // unaffected.
  const envConfig =
    upgradeConfig[c.env.ENVIRONMENT === "test" ? "test" : "production"];
  const platformUpgrade = platform ? envConfig[platform] : undefined;
  const upgrade = platformUpgrade
    ? {
        minVersion: platformUpgrade.minVersion,
        storeUrl: platformUpgrade.storeUrl,
        upgradeRequired: appVersion < platformUpgrade.minVersion,
      }
    : undefined;

  return c.json({ features, upgrade, timestamp: new Date().toISOString() });
});
