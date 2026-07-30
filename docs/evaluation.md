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

## Structured trace divergence

Outcome metrics answer whether a workflow finished correctly; they do not show
whether it reached that outcome through the expected execution path. ResolveOps
therefore records a privacy-safe fingerprint for every workflow step:

- Step index and stage
- Tool selected
- HMAC-SHA256 fingerprints of canonicalized inputs and outputs
- Step status and duration
- Workflow and tenant-policy versions at the run level

The comparator walks baseline and candidate traces in order and reports the
first divergence as one of: missing step, tool branch, input change, output
change, or state transition. It also marks downstream steps and explicitly
reports when an outcome-only evaluation would have missed the fork.

A single fingerprint change is not labeled distribution drift. Drift is a
population-level claim and belongs in a later aggregation layer over many
versioned trace comparisons.

Raw inputs and outputs are not stored in the trace comparison tables. A
production deployment must configure `TRACE_HMAC_SECRET`; the built-in fallback
exists only for this repository's simulated public dataset.

## Benchmark methodology

`npm run benchmark:trace` executes 30,000 deterministic trace comparisons. The
corpus rotates through five mutation classes plus unchanged controls while
holding the final workflow status constant. This intentionally tests the gap
the feature is designed to close: intermediate execution divergence hidden by
an identical final outcome.

The benchmark measures detection recall, divergence classification accuracy,
false-positive rate, and local comparison throughput. It does not claim to
measure semantic model quality or embedding performance.

### Recorded local result

On July 30, 2026, the versioned benchmark completed 30,000 comparisons with:

- 100% divergence-detection recall across 25,000 mutated traces
- 100% mutation-classification accuracy
- 0% false positives across 5,000 unchanged controls
- 19,051 comparisons per second, averaging 52.49 microseconds each
- 0% recall for the outcome-only baseline because every mutation preserved the
  same final workflow status

These are deterministic synthetic results, not production-quality or model
accuracy claims. The committed JSON result is in
`docs/benchmarks/trace-divergence.json`.
