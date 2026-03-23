CREATE TABLE `battle_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`raw_log` text NOT NULL,
	`parsed_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `battle_logs_game_id_unique` ON `battle_logs` (`game_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`game_number` integer NOT NULL,
	`winner_id` integer,
	`replay_url` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `trainers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`pairing_a_id` integer NOT NULL,
	`pairing_b_id` integer NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pairing_a_id`) REFERENCES `team_pairings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pairing_b_id`) REFERENCES `team_pairings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pokemon` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`trainer_id` integer NOT NULL,
	`species` text NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pokemon_game_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`pokemon_id` integer NOT NULL,
	`trainer_id` integer NOT NULL,
	`damage_dealt` real DEFAULT 0 NOT NULL,
	`damage_taken` real DEFAULT 0 NOT NULL,
	`kos` integer DEFAULT 0 NOT NULL,
	`faints` integer DEFAULT 0 NOT NULL,
	`turns_survived` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`budget` integer DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_pairings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`trainer_a_id` integer NOT NULL,
	`trainer_b_id` integer NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trainer_a_id`) REFERENCES `trainers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trainer_b_id`) REFERENCES `trainers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trainers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trainers_name_unique` ON `trainers` (`name`);--> statement-breakpoint
CREATE TABLE `turn_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`turn_number` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
