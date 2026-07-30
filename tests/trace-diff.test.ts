import assert from "node:assert/strict";
import test from "node:test";

import {
  compareTraceRuns,
  fingerprintTracePayload,
  type TraceRun,
} from "../lib/trace-diff.ts";

function run(id: string): TraceRun {
  return {
    id,
    label: id,
    tenantId: "meridian-health",
    workflowVersion: "resolver-1",
    policyVersion: "policy-12",
    release: "test",
    finalStatus: "pending_approval",
    steps: [
      {
        stepIndex: 0,
        stage: "retrieve",
        toolCalled: "asset_registry",
        inputFingerprint: fingerprintTracePayload({ asset: "pump-07" }, "test"),
        outputFingerprint: fingerprintTracePayload({ criticality: 10 }, "test"),
        status: "complete",
        durationMs: 12,
      },
      {
        stepIndex: 1,
        stage: "policy",
        toolCalled: "verify_authority",
        inputFingerprint: fingerprintTracePayload({ action: "escalate" }, "test"),
        outputFingerprint: fingerprintTracePayload({ approved: false }, "test"),
        status: "complete",
        durationMs: 8,
      },
    ],
  };
}

test("fingerprints are stable across object key order", () => {
  const first = fingerprintTracePayload({ b: 2, a: 1 }, "test-key");
  const second = fingerprintTracePayload({ a: 1, b: 2 }, "test-key");

  assert.equal(first, second);
});

test("finds the first tool branch even when final outcomes match", () => {
  const baseline = run("baseline");
  const candidate = structuredClone(baseline);
  candidate.id = "candidate";
  candidate.steps[1].toolCalled = "reconcile_external_action";

  const result = compareTraceRuns(baseline, candidate);

  assert.equal(result.firstDivergence?.stepIndex, 1);
  assert.equal(result.firstDivergence?.kind, "tool_branch");
  assert.equal(result.outcomeOnlyWouldMiss, true);
});

test("classifies input, output, state, and missing-step divergences", () => {
  const mutations = [
    {
      expected: "input_change",
      mutate(candidate: TraceRun) {
        candidate.steps[0].inputFingerprint = "changed-input";
      },
    },
    {
      expected: "output_change",
      mutate(candidate: TraceRun) {
        candidate.steps[0].outputFingerprint = "changed-output";
      },
    },
    {
      expected: "state_transition",
      mutate(candidate: TraceRun) {
        candidate.steps[0].status = "retrying";
      },
    },
    {
      expected: "missing_step",
      mutate(candidate: TraceRun) {
        candidate.steps.pop();
      },
    },
  ];

  for (const mutation of mutations) {
    const baseline = run("baseline");
    const candidate = structuredClone(baseline);
    mutation.mutate(candidate);
    assert.equal(
      compareTraceRuns(baseline, candidate).firstDivergence?.kind,
      mutation.expected,
    );
  }
});

test("does not invent divergence for equivalent traces", () => {
  const baseline = run("baseline");
  const candidate = structuredClone(baseline);

  const result = compareTraceRuns(baseline, candidate);

  assert.equal(result.firstDivergence, null);
  assert.equal(result.matchedSteps, 2);
  assert.equal(result.outcomeOnlyWouldMiss, false);
});
