# Evaluation strategy

ResolveOps evaluates whether an operational outcome was completed safely, not
whether a response sounds convincing.

## Primary metrics

- Verified task completion
- Tenant policy compliance
- Correct tool selection and arguments
- Human override rate
- P95 end-to-end latency
- Cost per completed case

## Dataset layers

1. **Golden cases** — reviewed examples for expected behavior.
2. **Adversarial cases** — prompt injection, missing assets, conflicting policy,
   duplicate events, and stale data.
3. **Production replay** — redacted traces with frozen tool results.
4. **Temporal holdout** — recent cases excluded from prompt and workflow tuning.

## Release rule

Candidates are compared with the current release by customer slice. Deployment
is blocked when any critical metric falls below that tenant's floor, even if
the aggregate score improves.

