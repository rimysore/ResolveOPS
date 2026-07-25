from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Recommendation(StrEnum):
    INSPECT = "inspect"
    REPAIR = "repair"
    REPLACE = "replace"
    ESCALATE = "escalate"


class WorkflowStatus(StrEnum):
    RESOLVED = "resolved"
    PENDING_APPROVAL = "pending_approval"
    NEEDS_REVIEW = "needs_review"
    REJECTED = "rejected"


@dataclass(frozen=True, slots=True)
class TenantPolicy:
    tenant_id: str
    name: str
    approval_threshold: float
    emergency_keywords: tuple[str, ...]
    replacement_age_years: int
    minimum_confidence: float = 0.72
    require_all_actions_approved: bool = False


@dataclass(frozen=True, slots=True)
class Asset:
    asset_id: str
    name: str
    category: str
    age_years: int
    replacement_cost: float
    repair_count_12m: int
    criticality: int
    warranty_active: bool = False


@dataclass(frozen=True, slots=True)
class WorkOrder:
    request_id: str
    tenant_id: str
    title: str
    description: str
    asset_id: str | None
    location: str
    reported_by: str = "operations"


@dataclass(frozen=True, slots=True)
class Evidence:
    source: str
    statement: str
    relevance: float


@dataclass(frozen=True, slots=True)
class TraceEvent:
    stage: str
    status: str
    detail: str
    recorded_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True, slots=True)
class Resolution:
    request_id: str
    tenant_id: str
    priority: Priority
    recommendation: Recommendation
    status: WorkflowStatus
    risk_score: int
    confidence: float
    estimated_cost: float
    rationale: str
    evidence: tuple[Evidence, ...]
    trace: tuple[TraceEvent, ...]
    approval_reason: str | None = None
