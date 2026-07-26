import { getClient } from "./client";

export type TenantRecord = {
  id: string;
  name: string;
  industry: string;
  policy_summary: string;
  approval_threshold: number;
  environment: string;
};

export type CaseRecord = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  external_id: string;
  title: string;
  description: string;
  asset_name: string;
  location: string;
  priority: string;
  status: string;
  risk_score: number;
  recommendation: string;
  rationale: string;
  estimated_cost: number;
  confidence: number;
  created_at: string;
};

export type EventRecord = {
  id: number;
  case_id: string;
  stage: string;
  label: string;
  status: string;
  detail: string;
  created_at: string;
};

export type EvaluationRecord = {
  id: number;
  release: string;
  tenant_id: string;
  tenant_name: string;
  task_completion: number;
  policy_compliance: number;
  p95_latency: number;
  cost_per_case: number;
  status: string;
};

let databaseReady: Promise<void> | null = null;

async function ensureDatabaseReady(): Promise<void> {
  if (!databaseReady) {
    databaseReady = initializeDatabase();
  }
  await databaseReady;
}

async function initializeDatabase(): Promise<void> {
  const db = getClient();
  await db.batch(
    [
      {
        sql: `
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        industry TEXT NOT NULL,
        policy_summary TEXT NOT NULL,
        approval_threshold REAL NOT NULL,
        environment TEXT NOT NULL DEFAULT 'sandbox',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
      },
      {
        sql: `
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        asset_name TEXT NOT NULL,
        location TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        recommendation TEXT NOT NULL,
        rationale TEXT NOT NULL,
        estimated_cost REAL NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `,
      },
      {
        sql: `
      CREATE TABLE IF NOT EXISTS case_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(id)
      )
    `,
      },
      {
        sql: `
      CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        release TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        task_completion REAL NOT NULL,
        policy_compliance REAL NOT NULL,
        p95_latency REAL NOT NULL,
        cost_per_case REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `,
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS cases_tenant_idx ON cases(tenant_id)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS events_case_idx ON case_events(case_id)",
      },
    ],
    "write",
  );
  await seedDatabase();
}

async function seedDatabase(): Promise<void> {
  const db = getClient();
  const tenants = [
    [
      "iu-facilities",
      "IU Facilities",
      "Higher education",
      "Human approval above $5,000",
      5000,
      "production mirror",
    ],
    [
      "meridian-health",
      "Meridian Health",
      "Healthcare",
      "Every action requires approval",
      0,
      "regulated sandbox",
    ],
    [
      "northstar-mfg",
      "Northstar Manufacturing",
      "Manufacturing",
      "Human approval above $12,000",
      12000,
      "customer cloud",
    ],
  ] as const;
  for (const tenant of tenants) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO tenants
          (id, name, industry, policy_summary, approval_threshold, environment)
         VALUES (?, ?, ?, ?, ?, ?)`,
      args: [...tenant],
    });
  }

  const cases = [
    [
      "case-1042",
      "iu-facilities",
      "WO-88421",
      "Air handler failed after fourth repair",
      "Biology 214 reports vibration and loss of cooling after repeated service.",
      "Biology 214 Air Handler",
      "Biology Building · Room 214",
      "high",
      "pending_approval",
      84,
      "replace",
      "The unit is beyond its service window and has four repairs in twelve months. Replacement reduces repeat-failure exposure.",
      18500,
      0.91,
      "2026-07-25T13:42:00Z",
    ],
    [
      "case-1041",
      "meridian-health",
      "INC-3917",
      "ICU chilled-water pump alarm",
      "Patient area cooling degraded after a pump alarm.",
      "ICU Chilled Water Pump 07",
      "Main Hospital · ICU",
      "critical",
      "pending_approval",
      96,
      "escalate",
      "The incident affects a critical patient area and a warrantied asset. Escalate to the approved service path.",
      2240,
      0.94,
      "2026-07-25T13:31:00Z",
    ],
    [
      "case-1040",
      "northstar-mfg",
      "MX-774",
      "Hydraulic press vibration returned",
      "Press line three crossed the vibration warning threshold after maintenance.",
      "Hydraulic Press Line 3",
      "Plant 2 · Line 3",
      "high",
      "investigating",
      88,
      "replace",
      "Repeated repairs and production criticality make replacement the lower-risk option.",
      74000,
      0.86,
      "2026-07-25T13:18:00Z",
    ],
    [
      "case-1039",
      "iu-facilities",
      "WO-88402",
      "Generator warning during weekly test",
      "Intermittent controller warning appeared during startup.",
      "Library Backup Generator",
      "Main Library · Lower Level",
      "medium",
      "resolved",
      42,
      "inspect",
      "The generator remains under warranty; verify the controller fault before authorizing repair.",
      1230,
      0.88,
      "2026-07-25T12:56:00Z",
    ],
  ] as const;
  for (const item of cases) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO cases
          (id, tenant_id, external_id, title, description, asset_name, location,
           priority, status, risk_score, recommendation, rationale,
           estimated_cost, confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [...item],
    });
  }

  const eventCount = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM case_events",
  });
  if (Number(eventCount.rows[0]?.count ?? 0) === 0) {
    const events = [
      ["case-1042", "ingest", "Request normalized", "complete", "Mapped AiM export to canonical work-order schema", "2026-07-25T13:42:01Z"],
      ["case-1042", "retrieve", "Asset history retrieved", "complete", "4 repairs · 14 years old · warranty expired", "2026-07-25T13:42:02Z"],
      ["case-1042", "plan", "Replacement recommended", "complete", "Repair-to-replacement ratio crossed tenant policy", "2026-07-25T13:42:04Z"],
      ["case-1042", "verify", "Evidence verified", "complete", "3 source records support the recommendation", "2026-07-25T13:42:05Z"],
      ["case-1042", "approval", "Human approval required", "waiting", "$18,500 estimate exceeds $5,000 authority", "2026-07-25T13:42:06Z"],
      ["case-1041", "ingest", "Alert received", "complete", "Webhook signature and customer mapping verified", "2026-07-25T13:31:01Z"],
      ["case-1041", "safety", "Critical workflow detected", "complete", "Patient-area policy activated", "2026-07-25T13:31:02Z"],
      ["case-1041", "approval", "Human approval required", "waiting", "Meridian requires approval for every external action", "2026-07-25T13:31:03Z"],
      ["case-1040", "tool", "Maintenance API retry", "investigating", "Vendor API returned 429; retry scheduled with idempotency key", "2026-07-25T13:18:07Z"],
      ["case-1039", "verify", "Inspection created", "complete", "External work-order ID WO-88402 reconciled", "2026-07-25T12:56:10Z"],
    ] as const;
    for (const event of events) {
      await db.execute({
        sql: `INSERT INTO case_events
            (case_id, stage, label, status, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        args: [...event],
      });
    }
  }

  const evalCount = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM evaluations",
  });
  if (Number(evalCount.rows[0]?.count ?? 0) === 0) {
    const evaluations = [
      ["v0.9.4", "iu-facilities", 0.94, 1, 3.8, 0.118, "promote"],
      ["v0.9.4", "meridian-health", 0.91, 1, 4.4, 0.143, "promote"],
      ["v0.9.4", "northstar-mfg", 0.89, 0.97, 4.1, 0.131, "promote"],
      ["candidate-v0.10", "iu-facilities", 0.97, 1, 3.4, 0.109, "pass"],
      ["candidate-v0.10", "meridian-health", 0.94, 0.88, 3.9, 0.136, "blocked"],
      ["candidate-v0.10", "northstar-mfg", 0.93, 0.98, 3.7, 0.125, "pass"],
    ] as const;
    for (const evaluation of evaluations) {
      await db.execute({
        sql: `INSERT INTO evaluations
            (release, tenant_id, task_completion, policy_compliance,
             p95_latency, cost_per_case, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [...evaluation],
      });
    }
  }
}

export async function getOverview() {
  await ensureDatabaseReady();
  const db = getClient();
  const [tenants, cases, events, evaluations] = await Promise.all([
    db.execute("SELECT * FROM tenants ORDER BY name"),
    db.execute(
      `SELECT cases.*, tenants.name AS tenant_name
         FROM cases JOIN tenants ON tenants.id = cases.tenant_id
         ORDER BY cases.created_at DESC`,
    ),
    db.execute("SELECT * FROM case_events ORDER BY created_at ASC"),
    db.execute(
      `SELECT evaluations.*, tenants.name AS tenant_name
         FROM evaluations JOIN tenants ON tenants.id = evaluations.tenant_id
         ORDER BY evaluations.id ASC`,
    ),
  ]);

  const tenantRows = tenants.rows as unknown as TenantRecord[];
  const caseRows = cases.rows as unknown as CaseRecord[];
  const eventRows = events.rows as unknown as EventRecord[];
  const evaluationRows = evaluations.rows as unknown as EvaluationRecord[];

  return {
    tenants: tenantRows,
    cases: caseRows.map((item) => ({
      ...item,
      events: eventRows.filter((event) => event.case_id === item.id),
    })),
    evaluations: evaluationRows,
  };
}

export async function approveCase(id: string, reviewer: string) {
  await ensureDatabaseReady();
  const db = getClient();
  const current = await db.execute({
    sql: "SELECT id, status FROM cases WHERE id = ?",
    args: [id],
  });
  const row = current.rows[0] as unknown as
    | { id: string; status: string }
    | undefined;
  if (!row) return null;
  if (row.status !== "pending_approval") {
    return { id, status: row.status, changed: false };
  }

  await db.batch(
    [
      {
        sql: "UPDATE cases SET status = 'approved' WHERE id = ?",
        args: [id],
      },
      {
        sql: `INSERT INTO case_events
          (case_id, stage, label, status, detail)
         VALUES (?, 'approval', 'Action approved', 'complete', ?)`,
        args: [id, `${reviewer} approved the bounded action`],
      },
    ],
    "write",
  );
  return { id, status: "approved", changed: true };
}

export async function requestCaseChanges(id: string, reviewer: string) {
  await ensureDatabaseReady();
  const db = getClient();
  const current = await db.execute({
    sql: "SELECT id, status FROM cases WHERE id = ?",
    args: [id],
  });
  const row = current.rows[0] as unknown as
    | { id: string; status: string }
    | undefined;
  if (!row) return null;
  if (row.status !== "pending_approval") {
    return { id, status: row.status, changed: false };
  }

  await db.batch(
    [
      {
        sql: "UPDATE cases SET status = 'investigating' WHERE id = ?",
        args: [id],
      },
      {
        sql: `INSERT INTO case_events
          (case_id, stage, label, status, detail)
         VALUES (?, 'approval', 'Changes requested', 'needs_review', ?)`,
        args: [id, `${reviewer} returned the plan for revision`],
      },
    ],
    "write",
  );
  return { id, status: "investigating", changed: true };
}
