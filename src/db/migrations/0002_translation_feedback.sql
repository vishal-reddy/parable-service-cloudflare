CREATE TABLE `translation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`screen` text,
	`note` text,
	`correction` text,
	`platform` text,
	`app_version` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
