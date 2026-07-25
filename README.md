# ResolveOps

**Enterprise AI operations you can verify.**

ResolveOps is a multi-tenant control plane for resolving operational work while
keeping humans accountable for consequential actions. It combines a typed
Python decision workflow with a TypeScript operations dashboard, durable
customer-specific state, approval gates, trace replay, and eval-driven release
decisions.

## What works today

- Three simulated customer environments with different policies
- Durable work-order, event, tenant, and evaluation records
- Customer and outcome filtering
- Evidence-backed repair/replace/escalate recommendations
- Human approval that updates the audit trail
- Per-customer release evaluation table
- A deliberately blocked release despite improved aggregate quality
- Python policy engine with deterministic safety boundaries
- Golden evaluation cases including prompt injection and missing assets
- Responsive TypeScript control plane

## Why this exists

Most agent demos end when the model returns an answer. Production systems begin
there. ResolveOps focuses on the last mile: customer schemas, authority,
failures, approvals, verification, and proving that a new release is safer than
the one already running.

## Architecture

```text
Customer systems
      │
      ▼
Connector + normalization layer
      │
      ▼
Python resolution workflow ─────► tenant policy engine
      │                                  │
      ├────► evidence + tools            │
      │                                  ▼
      └──────────────────────────► human approval
                                         │
                                         ▼
TypeScript control plane ◄──── durable trace + outcomes
              │
              ▼
       production replay + release gate
```

Read [the architecture](docs/architecture.md) and
[evaluation strategy](docs/evaluation.md) for the engineering decisions.

## Run the control plane

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the Python service

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn resolveops.api:app --reload --port 8000
```

## Verify

```bash
npm run lint
npm run test:web
python3 -m pytest services/api/tests
```

## Current boundary

The MVP does not pretend to execute real maintenance actions. Its tenant,
asset, and outcome data are seeded simulations. The next milestone is a
connector SDK, signed webhooks, idempotent external writes, and design-partner
validation with facilities operators.

