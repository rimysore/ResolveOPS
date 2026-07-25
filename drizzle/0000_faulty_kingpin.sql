CREATE TABLE `case_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`stage` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`asset_name` text NOT NULL,
	`location` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`risk_score` integer NOT NULL,
	`recommendation` text NOT NULL,
	`rationale` text NOT NULL,
	`estimated_cost` real NOT NULL,
	`confidence` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`release` text NOT NULL,
	`tenant_id` text NOT NULL,
	`task_completion` real NOT NULL,
	`policy_compliance` real NOT NULL,
	`p95_latency` real NOT NULL,
	`cost_per_case` real NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`policy_summary` text NOT NULL,
	`approval_threshold` real NOT NULL,
	`environment` text DEFAULT 'sandbox' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
