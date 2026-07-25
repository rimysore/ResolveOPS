import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  policySummary: text("policy_summary").notNull(),
  approvalThreshold: real("approval_threshold").notNull(),
  environment: text("environment").notNull().default("sandbox"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  assetName: text("asset_name").notNull(),
  location: text("location").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  riskScore: integer("risk_score").notNull(),
  recommendation: text("recommendation").notNull(),
  rationale: text("rationale").notNull(),
  estimatedCost: real("estimated_cost").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const caseEvents = sqliteTable("case_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id),
  stage: text("stage").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evaluations = sqliteTable("evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  release: text("release").notNull(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  taskCompletion: real("task_completion").notNull(),
  policyCompliance: real("policy_compliance").notNull(),
  p95Latency: real("p95_latency").notNull(),
  costPerCase: real("cost_per_case").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
