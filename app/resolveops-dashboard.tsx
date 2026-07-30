"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventRecord = {
  id: number;
  stage: string;
  label: string;
  status: string;
  detail: string;
  created_at: string;
};

type CaseRecord = {
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
  events: EventRecord[];
};

type TenantRecord = {
  id: string;
  name: string;
  industry: string;
  policy_summary: string;
  approval_threshold: number;
  environment: string;
};

type EvaluationRecord = {
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

type TraceStepFingerprint = {
  stepIndex: number;
  stage: string;
  toolCalled: string;
  inputFingerprint: string;
  outputFingerprint: string;
  status: string;
  durationMs: number;
};

type TraceRun = {
  id: string;
  label: string;
  tenantId: string;
  workflowVersion: string;
  policyVersion: string;
  release: string;
  finalStatus: string;
  steps: TraceStepFingerprint[];
};

type TraceDivergence = {
  stepIndex: number;
  kind: string;
  severity: string;
  baseline: string;
  candidate: string;
  explanation: string;
};

type TraceComparison = {
  baseline: TraceRun;
  candidate: TraceRun;
  firstDivergence: TraceDivergence | null;
  divergences: TraceDivergence[];
  matchedSteps: number;
  totalSteps: number;
  downstreamStepsAffected: number;
  outcomeOnlyWouldMiss: boolean;
};

type Overview = {
  tenants: TenantRecord[];
  cases: CaseRecord[];
  evaluations: EvaluationRecord[];
  traceComparison: TraceComparison;
};

type View = "operations" | "release" | "tenants";

const statusLabels: Record<string, string> = {
  pending_approval: "Needs approval",
  investigating: "Investigating",
  resolved: "Resolved",
  approved: "Approved",
};

const navItems: { id: View; label: string; meta: string }[] = [
  { id: "operations", label: "Operations", meta: "04" },
  { id: "release", label: "Release gate", meta: "01" },
  { id: "tenants", label: "Customers", meta: "03" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function ResolveOpsDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState("case-1042");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [view, setView] = useState<View>("operations");
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [gateRan, setGateRan] = useState(false);

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/overview", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load the operations dataset.");
    const data = (await response.json()) as Overview;
    setOverview(data);
    setSelectedCaseId((current) =>
      data.cases.some((item) => item.id === current)
        ? current
        : data.cases[0]?.id || "",
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/overview", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load the operations dataset.");
        }
        return (await response.json()) as Overview;
      })
      .then((data) => {
        setOverview(data);
        setSelectedCaseId((current) =>
          data.cases.some((item) => item.id === current)
            ? current
            : data.cases[0]?.id || "",
        );
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(
          cause instanceof Error ? cause.message : "Something went wrong.",
        );
      });
    return () => controller.abort();
  }, []);

  const filteredCases = useMemo(() => {
    if (!overview) return [];
    if (tenantFilter === "all") return overview.cases;
    return overview.cases.filter((item) => item.tenant_id === tenantFilter);
  }, [overview, tenantFilter]);

  const selectedCase =
    overview?.cases.find((item) => item.id === selectedCaseId) ??
    filteredCases[0] ??
    null;

  const approvalCount =
    overview?.cases.filter((item) => item.status === "pending_approval").length ??
    0;
  const averageConfidence = overview?.cases.length
    ? overview.cases.reduce((total, item) => total + item.confidence, 0) /
      overview.cases.length
    : 0;
  const openRisk =
    overview?.cases.reduce(
      (total, item) => total + (item.status === "resolved" ? 0 : item.risk_score),
      0,
    ) ?? 0;

  async function approveSelected() {
    if (!selectedCase) return;
    setApproving(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewer: "Rithvik · Operations lead" }),
      });
      if (!response.ok) throw new Error("Approval could not be recorded.");
      await loadOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval failed.");
    } finally {
      setApproving(false);
    }
  }

  async function requestChangesSelected() {
    if (!selectedCase) return;
    setRequestingChanges(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewer: "Rithvik · Operations lead" }),
      });
      if (!response.ok) throw new Error("The review request could not be recorded.");
      await loadOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review request failed.");
    } finally {
      setRequestingChanges(false);
    }
  }

  if (!overview && !error) {
    return (
      <main className="loading-shell">
        <div className="brand-mark" aria-hidden="true">R</div>
        <p>Connecting customer environments…</p>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="loading-shell error-state">
        <div className="brand-mark" aria-hidden="true">!</div>
        <h1>ResolveOps is temporarily offline</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry connection
        </button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="ResolveOps home">
          <span className="brand-mark">R</span>
          <span>
            <strong>ResolveOps</strong>
            <small>CONTROL PLANE</small>
          </span>
        </a>

        <div className="environment-card">
          <span className="live-dot" />
          <div>
            <small>ENVIRONMENT</small>
            <strong>Production mirror</strong>
          </div>
        </div>

        <nav aria-label="Primary">
          <p className="nav-label">WORKSPACE</p>
          {navItems.map((item) => (
            <button
              className={`nav-item ${view === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              <small>
                {item.id === "operations"
                  ? String(overview.cases.length).padStart(2, "0")
                  : item.meta}
              </small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="agent-status">
            <span className="agent-orbit" aria-hidden="true" />
            <div>
              <strong>Resolver v0.9.4</strong>
              <small>All systems nominal</small>
            </div>
          </div>
          <p>Scoped autonomy <span>Human accountable</span></p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {view === "operations"
                ? "LIVE OPERATIONS"
                : view === "release"
                  ? "MODEL RELEASE"
                  : "CUSTOMER ENVIRONMENTS"}
            </p>
            <h1>
              {view === "operations"
                ? "Outcome control"
                : view === "release"
                  ? "Release evidence"
                  : "Deployment profiles"}
            </h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-state"><i />Synced 12s ago</span>
            <button
              className="primary-button compact"
              onClick={() => setView("release")}
              type="button"
            >
              Run release gate
            </button>
            <div className="avatar" aria-label="Rithvik profile">RM</div>
          </div>
        </header>

        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        {view === "operations" ? (
          <>
            <section className="metrics-grid" aria-label="Operations metrics">
              <Metric
                label="Open outcomes"
                value={String(
                  overview.cases.filter((item) => item.status !== "resolved").length,
                ).padStart(2, "0")}
                note="Across 3 customer environments"
              />
              <Metric
                label="Awaiting human"
                value={String(approvalCount).padStart(2, "0")}
                note="No autonomous high-risk actions"
                tone="warning"
              />
              <Metric
                label="Mean confidence"
                value={`${Math.round(averageConfidence * 100)}%`}
                note="Evidence-backed resolutions"
                tone="positive"
              />
              <Metric
                label="Open risk"
                value={String(openRisk)}
                note="Weighted operational points"
              />
            </section>

            <section className="operations-grid">
              <div className="panel queue-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">OUTCOME QUEUE</p>
                    <h2>Customer work</h2>
                  </div>
                  <label className="select-wrap">
                    <span className="sr-only">Filter by customer</span>
                    <select
                      value={tenantFilter}
                      onChange={(event) => setTenantFilter(event.target.value)}
                    >
                      <option value="all">All customers</option>
                      {overview.tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="case-list">
                  {filteredCases.map((item) => (
                    <button
                      className={`case-row ${
                        selectedCase?.id === item.id ? "selected" : ""
                      }`}
                      key={item.id}
                      onClick={() => setSelectedCaseId(item.id)}
                      type="button"
                    >
                      <span className={`priority-bar ${item.priority}`} />
                      <span className="case-main">
                        <span className="case-meta">
                          <strong>{item.external_id}</strong>
                          <span>{item.tenant_name}</span>
                        </span>
                        <b>{item.title}</b>
                        <small>{item.location}</small>
                      </span>
                      <span className="case-state">
                        <em className={`status-pill ${item.status}`}>
                          {statusLabels[item.status] ?? item.status}
                        </em>
                        <small>{formatTime(item.created_at)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedCase ? (
                <CaseDetail
                  item={selectedCase}
                  approving={approving}
                  requestingChanges={requestingChanges}
                  onApprove={approveSelected}
                  onRequestChanges={requestChangesSelected}
                />
              ) : null}
            </section>
          </>
        ) : null}

        {view === "release" ? (
          <ReleaseGate
            evaluations={overview.evaluations}
            traceComparison={overview.traceComparison}
            ran={gateRan}
            onRun={() => setGateRan(true)}
          />
        ) : null}

        {view === "tenants" ? (
          <TenantGrid tenants={overview.tenants} cases={overview.cases} />
        ) : null}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function CaseDetail({
  item,
  approving,
  requestingChanges,
  onApprove,
  onRequestChanges,
}: {
  item: CaseRecord;
  approving: boolean;
  requestingChanges: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  const actionable = item.status === "pending_approval";
  return (
    <article className="panel detail-panel">
      <div className="detail-topline">
        <span className={`risk-badge risk-${item.priority}`}>
          Risk {item.risk_score}
        </span>
        <span>{item.external_id}</span>
      </div>
      <h2>{item.title}</h2>
      <p className="detail-description">{item.description}</p>

      <div className="asset-card">
        <div>
          <small>VERIFIED ASSET</small>
          <strong>{item.asset_name}</strong>
          <span>{item.location}</span>
        </div>
        <div className="confidence-ring">
          <strong>{Math.round(item.confidence * 100)}</strong>
          <small>% CONF.</small>
        </div>
      </div>

      <div className="recommendation">
        <p className="eyebrow">RESOLUTION PLAN</p>
        <div className="recommendation-title">
          <h3>{item.recommendation} asset</h3>
          <strong>{formatCurrency(item.estimated_cost)}</strong>
        </div>
        <p>{item.rationale}</p>
      </div>

      <div className="trace">
        <div className="section-title">
          <p className="eyebrow">EXECUTION TRACE</p>
          <span>{item.events.length} spans</span>
        </div>
        <ol>
          {item.events.map((event) => (
            <li className={event.status} key={event.id}>
              <span className="trace-node" />
              <div>
                <strong>{event.label}</strong>
                <p>{event.detail}</p>
              </div>
              <time>{formatTime(event.created_at)}</time>
            </li>
          ))}
        </ol>
      </div>

      <div className="approval-actions">
        {actionable ? (
          <>
            <button
              className="secondary-button"
              disabled={requestingChanges}
              onClick={onRequestChanges}
              type="button"
            >
              {requestingChanges ? "Recording…" : "Request changes"}
            </button>
            <button
              className="primary-button"
              disabled={approving}
              onClick={onApprove}
              type="button"
            >
              {approving ? "Recording…" : "Approve bounded action"}
            </button>
          </>
        ) : (
          <div className="approved-banner">
            <span>✓</span>
            <div>
              <strong>
                {item.status === "resolved" ? "Outcome verified" : "Approval recorded"}
              </strong>
              <small>Audit trail is up to date</small>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ReleaseGate({
  evaluations,
  traceComparison,
  ran,
  onRun,
}: {
  evaluations: EvaluationRecord[];
  traceComparison: TraceComparison;
  ran: boolean;
  onRun: () => void;
}) {
  const candidate = evaluations.filter((item) =>
    item.release.startsWith("candidate"),
  );
  const blocked = candidate.find((item) => item.status === "blocked");

  return (
    <section className="release-layout">
      <div className="release-hero">
        <div>
          <p className="eyebrow">CANDIDATE V0.10</p>
          <h2>Better overall. Unsafe for one customer.</h2>
          <p>
            The candidate improves task completion and latency, but Meridian
            Health’s policy compliance falls below its release floor.
          </p>
        </div>
        <button className="primary-button" onClick={onRun} type="button">
          {ran ? "Gate completed" : "Replay 300 production cases"}
        </button>
      </div>

      <div className={`gate-banner ${ran ? "visible" : ""}`}>
        <span className="gate-icon">!</span>
        <div>
          <small>DEPLOYMENT BLOCKED</small>
          <strong>
            {blocked?.tenant_name ?? "A customer"} regressed on policy compliance
          </strong>
        </div>
        <code>88% &lt; 98% floor</code>
      </div>

      <TraceDiffPanel comparison={traceComparison} />

      <div className="panel evaluation-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">CUSTOMER SLICES</p>
            <h2>Release evidence</h2>
          </div>
          <span className="dataset-chip">300 replay cases · temporal holdout</span>
        </div>
        <div className="evaluation-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Task completion</th>
                <th>Policy compliance</th>
                <th>P95 latency</th>
                <th>Cost / case</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {candidate.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.tenant_name}</strong>
                    <small>{item.tenant_id}</small>
                  </td>
                  <td>{Math.round(item.task_completion * 100)}%</td>
                  <td className={item.status === "blocked" ? "danger-cell" : ""}>
                    {Math.round(item.policy_compliance * 100)}%
                  </td>
                  <td>{item.p95_latency.toFixed(1)}s</td>
                  <td>${item.cost_per_case.toFixed(3)}</td>
                  <td><span className={`decision ${item.status}`}>{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="release-notes">
        <article>
          <small>FAILURE CLUSTER</small>
          <strong>Approval bypass after tool retry</strong>
          <p>
            Four replay cases skipped a second approval check when the external
            action timed out after submission.
          </p>
        </article>
        <article>
          <small>RECOMMENDED FIX</small>
          <strong>Re-verify authority before reconciliation</strong>
          <p>
            Keep policy checks outside the model and execute them before every
            side-effect attempt.
          </p>
        </article>
        <article>
          <small>ROLLOUT PLAN</small>
          <strong>Canary IU only after fix</strong>
          <p>
            Release to 5% of university traffic, then require 24 hours with no
            policy or task-completion regression.
          </p>
        </article>
      </div>
    </section>
  );
}

const divergenceLabels: Record<string, string> = {
  missing_step: "Step shape changed",
  tool_branch: "Tool branch changed",
  input_change: "Input changed",
  output_change: "Tool output changed",
  state_transition: "State changed",
};

function shortFingerprint(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function TraceDiffPanel({ comparison }: { comparison: TraceComparison }) {
  const first = comparison.firstDivergence;
  const baselineByStep = new Map(
    comparison.baseline.steps.map((step) => [step.stepIndex, step]),
  );
  const candidateByStep = new Map(
    comparison.candidate.steps.map((step) => [step.stepIndex, step]),
  );

  return (
    <section className="panel trace-diff-panel">
      <div className="trace-diff-heading">
        <div>
          <p className="eyebrow">STRUCTURED TRACE DIFF</p>
          <h2>Same outcome. Different execution path.</h2>
          <p>
            Outcome-only evaluation sees two pending approvals. Step fingerprints
            expose the candidate taking an unexpected reconciliation branch first.
          </p>
        </div>
        <div className="divergence-verdict">
          <small>FIRST DIVERGENCE</small>
          <strong>
            {first
              ? `Step ${String(first.stepIndex + 1).padStart(2, "0")} · ${
                  divergenceLabels[first.kind] ?? first.kind
                }`
              : "No divergence"}
          </strong>
          <span>{first?.explanation ?? "Runs match step for step."}</span>
        </div>
      </div>

      <div className="trace-proof-grid">
        <article>
          <small>OUTCOME-ONLY CHECK</small>
          <strong className="missed">
            {comparison.outcomeOnlyWouldMiss ? "Missed" : "Detected"}
          </strong>
          <span>
            Both runs ended {comparison.baseline.finalStatus.replaceAll("_", " ")}
          </span>
        </article>
        <article>
          <small>STEP FINGERPRINT CHECK</small>
          <strong className="detected">
            {first ? `Detected at step ${first.stepIndex + 1}` : "No change"}
          </strong>
          <span>{comparison.downstreamStepsAffected} downstream steps affected</span>
        </article>
        <article>
          <small>PAYLOAD HANDLING</small>
          <strong>HMAC-SHA256</strong>
          <span>Inputs and outputs are fingerprinted, not stored</span>
        </article>
      </div>

      <div className="run-version-row">
        <div>
          <span className="run-dot baseline" />
          <strong>{comparison.baseline.label}</strong>
          <code>{comparison.baseline.workflowVersion}</code>
        </div>
        <div>
          <span className="run-dot candidate" />
          <strong>{comparison.candidate.label}</strong>
          <code>{comparison.candidate.workflowVersion}</code>
        </div>
        <span>Policy {comparison.candidate.policyVersion}</span>
      </div>

      <div className="trace-step-list">
        {Array.from({ length: comparison.totalSteps }, (_, stepIndex) => {
          const expected = baselineByStep.get(stepIndex);
          const actual = candidateByStep.get(stepIndex);
          const rowDivergence = comparison.divergences.find(
            (item) => item.stepIndex === stepIndex,
          );
          const afterFork =
            first !== null && stepIndex > first.stepIndex && !rowDivergence;
          return (
            <article
              className={`trace-step-row ${
                rowDivergence ? "diverged" : afterFork ? "downstream" : "matched"
              }`}
              key={stepIndex}
            >
              <div className="step-index">
                <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                <i />
              </div>
              <TraceStepCell label="BASELINE" step={expected} />
              <div className="step-compare-state">
                {rowDivergence
                  ? divergenceLabels[rowDivergence.kind] ?? "Changed"
                  : afterFork
                    ? "Shifted after fork"
                    : "Exact match"}
              </div>
              <TraceStepCell label="CANDIDATE" step={actual} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TraceStepCell({
  label,
  step,
}: {
  label: string;
  step: TraceStepFingerprint | undefined;
}) {
  if (!step) {
    return (
      <div className="trace-step-cell empty">
        <small>{label}</small>
        <strong>Missing step</strong>
      </div>
    );
  }
  return (
    <div className="trace-step-cell">
      <small>{label} · {step.stage}</small>
      <strong>{step.toolCalled}</strong>
      <span>
        in {shortFingerprint(step.inputFingerprint)} · out{" "}
        {shortFingerprint(step.outputFingerprint)}
      </span>
      <code>{step.durationMs}ms · {step.status}</code>
    </div>
  );
}

function TenantGrid({
  tenants,
  cases,
}: {
  tenants: TenantRecord[];
  cases: CaseRecord[];
}) {
  return (
    <section className="tenant-grid">
      {tenants.map((tenant, index) => {
        const tenantCases = cases.filter((item) => item.tenant_id === tenant.id);
        return (
          <article className="tenant-card" key={tenant.id}>
            <div className={`tenant-monogram tenant-${index}`}>
              {tenant.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}
            </div>
            <p className="eyebrow">{tenant.industry}</p>
            <h2>{tenant.name}</h2>
            <p className="tenant-policy">{tenant.policy_summary}</p>
            <dl>
              <div><dt>Environment</dt><dd>{tenant.environment}</dd></div>
              <div>
                <dt>Open outcomes</dt>
                <dd>
                  {tenantCases.filter((item) => item.status !== "resolved").length}
                </dd>
              </div>
              <div><dt>Connector health</dt><dd className="healthy">Healthy</dd></div>
            </dl>
            <div className="deployment-ready">Profile active · policy synced</div>
          </article>
        );
      })}
    </section>
  );
}
