# ResolveOps Python service

The Python service owns the parts of ResolveOps that must remain explicit and
testable: canonical work-order models, tenant policy enforcement, risk scoring,
approval gates, trace events, and regression evaluation.

The initial workflow is deterministic by design. A model adapter will later
assist classification, retrieval, and plan drafting, while policy, authority,
and execution verification remain outside the model.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn resolveops.api:app --reload --port 8000
pytest
```

Useful endpoints:

- `GET /health`
- `POST /v1/resolve`
- `POST /v1/evaluations/run`

