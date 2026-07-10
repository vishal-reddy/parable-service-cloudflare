-- App-wide announcements shown in the mobile apps (Settings → Announcements).
-- Rows are inserted with `wrangler d1 execute` (see src/routes/announcements.ts);
-- ids are monotonically increasing so clients can track the last-seen id.
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `announcements` (`title`, `body`) VALUES (
	'Welcome to Announcements',
	'App-wide news will appear here — new confessions and catechisms, feature releases, and other updates. Check back after each release.'
);
