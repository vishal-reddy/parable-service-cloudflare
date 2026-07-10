/**
 * Admin-editable configuration overrides, stored as JSON blobs in the
 * `app_config` D1 table (one row per key). Reads tolerate a missing table so
 * /api/features keeps working if a deploy lands before the migration runs.
 */

export type FeatureOverrides = Record<string, boolean>;

export interface UpgradePlatformConfig {
  minVersion: number;
  storeUrl: string;
}

export type UpgradeOverrides = Partial<
  Record<"android" | "ios", UpgradePlatformConfig>
>;

export const FEATURES_KEY = "feature-overrides";
export const UPGRADE_KEY = "upgrade-overrides";

export async function getConfigJson<T>(
  db: D1Database,
  key: string
): Promise<T | null> {
  try {
    const row = await db
      .prepare("SELECT value FROM app_config WHERE key = ?")
      .bind(key)
      .first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export async function putConfigJson(
  db: D1Database,
  key: string,
  value: unknown
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                      updated_at = excluded.updated_at`
    )
    .bind(key, JSON.stringify(value))
    .run();
}
