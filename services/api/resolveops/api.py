from dataclasses import asdict

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

from .domain import WorkOrder
from .evals import run_evaluation
from .workflow import ResolutionWorkflow

app = FastAPI(
    title="ResolveOps API",
    version="0.1.0",
    description="Typed resolution workflows and regression evaluation for enterprise operations.",
)
workflow = ResolutionWorkflow()


class ResolveRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    request_id: str = Field(min_length=3, max_length=80)
    tenant_id: str = Field(min_length=3, max_length=80)
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=5, max_length=4_000)
    asset_id: str | None = Field(default=None, max_length=100)
    location: str = Field(min_length=2, max_length=160)
    reported_by: str = Field(default="operations", max_length=160)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "resolveops-api"}


@app.post("/v1/resolve")
def resolve(request: ResolveRequest) -> dict:
    result = workflow.resolve(WorkOrder(**request.model_dump()))
    return asdict(result)


@app.post("/v1/evaluations/run")
def evaluate() -> dict:
    return asdict(run_evaluation(workflow))
