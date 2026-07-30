CREATE TABLE `trace_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`label` text NOT NULL,
	`workflow_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`release` text NOT NULL,
	`final_status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trace_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`stage` text NOT NULL,
	`tool_called` text NOT NULL,
	`input_fingerprint` text NOT NULL,
	`output_fingerprint` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `trace_runs`(`id`) ON UPDATE no action ON DELETE no action
);
