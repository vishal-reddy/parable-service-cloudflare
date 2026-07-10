-- Admin-editable configuration overrides (feature toggles, upgrade gate),
-- managed from the trueconfessions.app/admin dashboard. One JSON blob per key.
CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
