# ResolveOps architecture

ResolveOps separates probabilistic assistance from deterministic authority.

## Control plane

The TypeScript control plane runs the operator experience, tenant deployment
profiles, durable case state, approval actions, execution traces, and release
evidence. The hosted version uses Cloudflare D1 through prepared statements.

## Decision service

The Python service owns the canonical work-order model and the resolution state
machine:

1. Ingest and normalize customer data.
2. Reject untrusted instructions in customer-controlled content.
3. Verify the tenant and asset identity.
4. Classify operational priority.
5. Draft a bounded recommendation.
6. Calculate risk, confidence, and cost deterministically.
7. Verify evidence and tenant policy.
8. Require a human when authority, severity, or confidence demands it.

The current MVP uses deterministic classification to make the safety boundary
obvious. Model adapters can later assist classification, retrieval, and plan
drafting, but cannot change approval policy or claim an external action
succeeded.

## Why three tenant environments

An aggregate eval can hide customer-specific failure. ResolveOps therefore
stores policies, release floors, connector behavior, and eval results per
tenant. A candidate release may pass globally and still be blocked for one
customer.

## Reliability boundaries

- Customer-controlled text is untrusted.
- All external writes require idempotency keys.
- HTTP success is not accepted as business outcome completion.
- High-risk actions remain approval-gated.
- Every decision records workflow and configuration versions.
- Production failures become labeled replay cases.

