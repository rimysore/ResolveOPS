from fastapi.testclient import TestClient

from resolveops.api import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "resolveops-api"}


def test_resolve_returns_an_auditable_decision() -> None:
    response = client.post(
        "/v1/resolve",
        json={
            "request_id": "CASE-TEST-001",
            "tenant_id": "iu-facilities",
            "title": "Cooling failure in a research building",
            "description": (
                "The air handler is making a loud noise again after four recent repairs."
            ),
            "asset_id": "ahu-bio-214",
            "location": "Biology 214",
            "reported_by": "Facilities dispatch",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["request_id"] == "CASE-TEST-001"
    assert payload["recommendation"] == "replace"
    assert payload["status"] == "pending_approval"
    assert payload["trace"][-1]["stage"] == "approval_gate"


def test_evaluation_run_exposes_release_gate() -> None:
    response = client.post("/v1/evaluations/run")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 6
    assert payload["passed"] == 6
    assert payload["policy_compliance"] == 1
