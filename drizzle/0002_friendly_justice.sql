ALTER TABLE `products` RENAME TO `entries`;--> statement-breakpoint
ALTER TABLE `entries` RENAME COLUMN "name" TO "description";--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` real NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entries` (
	`id` integer PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`category_id` integer,
	`date` text NOT NULL,
	`value` real NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_entries`("id", "description", "category_id", "date", "value") SELECT "id", "description", "category_id", "date", "value" FROM `entries`;--> statement-breakpoint
DROP TABLE `entries`;--> statement-breakpoint
ALTER TABLE `__new_entries` RENAME TO `entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `categories` ADD `is_income` integer DEFAULT false NOT NULL;