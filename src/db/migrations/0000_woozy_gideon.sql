CREATE TABLE `acts` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'none' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`summary` text,
	`assessed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `beats` (
	`id` text PRIMARY KEY NOT NULL,
	`act_id` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'none' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`act_id`) REFERENCES `acts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`age` integer,
	`gender` text DEFAULT 'unknown' NOT NULL,
	`build` text DEFAULT 'unknown' NOT NULL,
	`height` text DEFAULT 'unknown' NOT NULL,
	`temperament_major` text DEFAULT 'unknown' NOT NULL,
	`temperament_minor` text DEFAULT 'unknown' NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tool` text NOT NULL,
	`session_id` text NOT NULL,
	`project_path` text,
	`started_at` text,
	`ended_at` text,
	`message_count` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ethics_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`overall_score` real,
	`misuse_score` real,
	`bias_score` real,
	`harm_score` real,
	`epistemology_score` real,
	`virtue_alignment_score` real,
	`extra_categories` text,
	`analysis` text,
	`recommendations` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`resemblance` text,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prompt_engineering_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`overall_score` real,
	`clarity_score` real,
	`specificity_score` real,
	`context_setting_score` real,
	`iterative_refinement_score` real,
	`conversation_quality_score` real,
	`analysis` text,
	`recommendations` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `puritan_authors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`years` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `puritan_work_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`token_id` text NOT NULL,
	`match_count` integer DEFAULT 0 NOT NULL,
	`snippet` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `puritan_works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`token_id`) REFERENCES `search_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `puritan_works` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`file_path` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `puritan_authors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `search_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`source_key` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_tokens_token_unique` ON `search_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weather_forecast` (
	`time` text PRIMARY KEY NOT NULL,
	`temperature` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
