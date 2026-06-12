CREATE TABLE `protagonist_state` (
	`id` text PRIMARY KEY,
	`chat_id` text NOT NULL,
	`profile` text NOT NULL,
	`dimensions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `story` ADD `world_snapshot` text;--> statement-breakpoint
ALTER TABLE `story` ADD `task_state` text;