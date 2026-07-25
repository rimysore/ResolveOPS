from __future__ import annotations

import re
from collections.abc import Mapping

from .catalog import ASSETS, TENANT_POLICIES
from .domain import (
    Asset,
    Evidence,
    Priority,
    Recommendation,
    Resolution,
    TenantPolicy,
    TraceEvent,
    WorkflowStatus,
    WorkOrder,
)

PROMPT_INJECTION_MARKERS = (
    "ignore previous",
    "system prompt",
    "reveal secret",
    "bypass approval",
)


class ResolutionWorkflow:
    """Deterministic shell around model-dependent decisions.

    The MVP intentionally keeps policy, risk, cost, and approval logic outside
    the model. A future model adapter can assist classification and retrieval
    without being allowed to bypass these controls.
    """

    def __init__(
        self,
        policies: Mapping[str, TenantPolicy] | None = None,
        assets: Mapping[str, Asset] | None = None,
    ) -> None:
        self.policies = dict(policies or TENANT_POLICIES)
        self.assets = dict(assets or ASSETS)

    def resolve(self, order: WorkOrder) -> Resolution:
        trace: list[TraceEvent] = [
            TraceEvent("ingest", "complete", f"Accepted request {order.request_id}"),
            TraceEvent("normalize", "complete", "Mapped request to canonical work-order schema"),
        ]

        policy = self.policies.get(order.tenant_id)
        if not policy:
            return self._manual_review(
                order,
                trace,
                "Unknown tenant configuration; no policy decisions were attempted",
            )

        clean_text = self._normalize_text(f"{order.title} {order.description}")
        if any(marker in clean_text for marker in PROMPT_INJECTION_MARKERS):
            trace.append(
                TraceEvent(
                    "safety",
                    "blocked",
                    "Untrusted instructions detected in customer-controlled content",
                )
            )
            return self._manual_review(order, trace, "Potential prompt injection detected")

        asset = self.assets.get(order.asset_id or "")
        if not asset:
            trace.append(
                TraceEvent("retrieve_asset", "needs_review", "No verified asset record matched")
            )
            return self._manual_review(order, trace, "Asset identity must be confirmed")

        trace.append(
            TraceEvent(
                "retrieve_asset",
                "complete",
                f"Matched {asset.name}; age {asset.age_years}y; "
                f"{asset.repair_count_12m} repairs in 12m",
            )
        )

        priority = self._priority(clean_text, policy, asset)
        recommendation = self._recommend(asset, priority, policy)
        cost = self._estimate_cost(asset, recommendation)
        risk = self._risk_score(asset, priority)
        confidence = self._confidence(order, asset)
        evidence = self._evidence(asset, policy, recommendation)
        rationale = self._rationale(asset, recommendation, priority)

        trace.extend(
            (
                TraceEvent("classify", "complete", f"Priority set to {priority.value}"),
                TraceEvent(
                    "plan",
                    "complete",
                    f"Recommended {recommendation.value}; estimated cost ${cost:,.0f}",
                ),
                TraceEvent(
                    "verify",
                    "complete",
                    f"Policy and evidence checks passed at {confidence:.0%} confidence",
                ),
            )
        )

        approval_reason = self._approval_reason(
            policy=policy,
            priority=priority,
            estimated_cost=cost,
            confidence=confidence,
        )
        status = WorkflowStatus.PENDING_APPROVAL if approval_reason else WorkflowStatus.RESOLVED
        trace.append(
            TraceEvent(
                "approval_gate",
                "waiting" if approval_reason else "not_required",
                approval_reason or "Action is within configured authority",
            )
        )

        return Resolution(
            request_id=order.request_id,
            tenant_id=order.tenant_id,
            priority=priority,
            recommendation=recommendation,
            status=status,
            risk_score=risk,
            confidence=confidence,
            estimated_cost=cost,
            rationale=rationale,
            evidence=evidence,
            trace=tuple(trace),
            approval_reason=approval_reason,
        )

    @staticmethod
    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", text.strip().lower())

    @staticmethod
    def _priority(text: str, policy: TenantPolicy, asset: Asset) -> Priority:
        if any(keyword in text for keyword in policy.emergency_keywords):
            return Priority.CRITICAL
        if asset.criticality >= 9:
            return Priority.HIGH
        if asset.repair_count_12m >= 3:
            return Priority.HIGH
        if any(word in text for word in ("noise", "intermittent", "warning")):
            return Priority.MEDIUM
        return Priority.LOW

    @staticmethod
    def _recommend(asset: Asset, priority: Priority, policy: TenantPolicy) -> Recommendation:
        if priority is Priority.CRITICAL and asset.warranty_active:
            return Recommendation.ESCALATE
        replacement_pressure = (
            asset.age_years >= policy.replacement_age_years
            and asset.repair_count_12m >= 3
            and not asset.warranty_active
        )
        if replacement_pressure:
            return Recommendation.REPLACE
        if asset.warranty_active:
            return Recommendation.INSPECT
        return Recommendation.REPAIR

    @staticmethod
    def _estimate_cost(asset: Asset, recommendation: Recommendation) -> float:
        if recommendation is Recommendation.REPLACE:
            return asset.replacement_cost
        if recommendation is Recommendation.REPAIR:
            return round(asset.replacement_cost * 0.16, 2)
        if recommendation is Recommendation.ESCALATE:
            return round(asset.replacement_cost * 0.08, 2)
        return round(asset.replacement_cost * 0.03, 2)

    @staticmethod
    def _risk_score(asset: Asset, priority: Priority) -> int:
        priority_weight = {
            Priority.LOW: 8,
            Priority.MEDIUM: 18,
            Priority.HIGH: 29,
            Priority.CRITICAL: 42,
        }[priority]
        return min(
            100,
            priority_weight + asset.criticality * 4 + min(asset.repair_count_12m * 3, 15),
        )

    @staticmethod
    def _confidence(order: WorkOrder, asset: Asset) -> float:
        score = 0.68
        if len(order.description.split()) >= 8:
            score += 0.09
        if order.asset_id == asset.asset_id:
            score += 0.12
        if order.location:
            score += 0.06
        return min(score, 0.95)

    @staticmethod
    def _evidence(
        asset: Asset,
        policy: TenantPolicy,
        recommendation: Recommendation,
    ) -> tuple[Evidence, ...]:
        return (
            Evidence(
                "asset-registry",
                f"{asset.name} is {asset.age_years} years old with "
                f"{asset.repair_count_12m} repairs in the last 12 months.",
                0.98,
            ),
            Evidence(
                "tenant-policy",
                f"{policy.name} requires approval above ${policy.approval_threshold:,.0f}.",
                1.0,
            ),
            Evidence(
                "decision-policy",
                f"{recommendation.value.title()} selected from age, repair history, "
                "warranty, criticality, and incident priority.",
                0.91,
            ),
        )

    @staticmethod
    def _rationale(
        asset: Asset,
        recommendation: Recommendation,
        priority: Priority,
    ) -> str:
        if recommendation is Recommendation.REPLACE:
            return (
                f"{asset.name} is beyond the preferred service window and has "
                f"required {asset.repair_count_12m} repairs in twelve months. "
                "Replacement reduces repeat-failure exposure."
            )
        if recommendation is Recommendation.ESCALATE:
            return (
                f"The {priority.value} incident affects a critical, warrantied asset. "
                "Escalate to the approved service path before changing equipment."
            )
        if recommendation is Recommendation.INSPECT:
            return (
                "The asset remains under warranty. Verify the fault and preserve "
                "warranty coverage before authorizing repair."
            )
        return (
            "The asset is inside the replacement window and the estimated repair "
            "remains materially below replacement cost."
        )

    @staticmethod
    def _approval_reason(
        policy: TenantPolicy,
        priority: Priority,
        estimated_cost: float,
        confidence: float,
    ) -> str | None:
        reasons: list[str] = []
        if policy.require_all_actions_approved:
            reasons.append("tenant requires human approval for every action")
        elif estimated_cost > policy.approval_threshold:
            reasons.append(f"estimated cost exceeds ${policy.approval_threshold:,.0f} authority")
        if priority is Priority.CRITICAL:
            reasons.append("critical incident requires accountable human review")
        if confidence < policy.minimum_confidence:
            reasons.append(
                f"confidence is below the tenant's {policy.minimum_confidence:.0%} floor"
            )
        return "; ".join(reasons) or None

    @staticmethod
    def _manual_review(
        order: WorkOrder,
        trace: list[TraceEvent],
        reason: str,
    ) -> Resolution:
        trace.append(TraceEvent("human_review", "waiting", reason))
        return Resolution(
            request_id=order.request_id,
            tenant_id=order.tenant_id,
            priority=Priority.MEDIUM,
            recommendation=Recommendation.INSPECT,
            status=WorkflowStatus.NEEDS_REVIEW,
            risk_score=50,
            confidence=0.0,
            estimated_cost=0,
            rationale=reason,
            evidence=(),
            trace=tuple(trace),
            approval_reason=reason,
        )
