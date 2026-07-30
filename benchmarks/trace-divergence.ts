import {
  compareTraceRuns,
  fingerprintTracePayload,
  type TraceDivergenceKind,
  type TraceRun,
} from "../lib/trace-diff.ts";

const ITERATIONS = 30_000;
const mutationKinds = [
  "tool_branch",
  "input_change",
  "output_change",
  "state_transition",
  "missing_step",
  "none",
] as const;

function makeRun(id: string): TraceRun {
  return {
    id,
    label: id,
    tenantId: "benchmark-tenant",
    workflowVersion: "resolver-benchmark",
    policyVersion: "policy-1",
    release: "benchmark",
    finalStatus: "pending_approval",
    steps: Array.from({ length: 8 }, (_, stepIndex) => ({
      stepIndex,
      stage: `stage-${stepIndex}`,
      toolCalled: `tool-${stepIndex}`,
      inputFingerprint: fingerprintTracePayload(
        { stepIndex, direction: "input" },
        "benchmark",
      ),
      outputFingerprint: fingerprintTracePayload(
        { stepIndex, direction: "output" },
        "benchmark",
      ),
      status: stepIndex === 7 ? "waiting" : "complete",
      durationMs: 10 + stepIndex,
    })),
  };
}

function mutate(
  source: TraceRun,
  kind: (typeof mutationKinds)[number],
  stepIndex: number,
): TraceRun {
  const candidate = structuredClone(source);
  candidate.id = `${source.id}-candidate`;
  if (kind === "tool_branch") candidate.steps[stepIndex].toolCalled = "alternate-tool";
  if (kind === "input_change") candidate.steps[stepIndex].inputFingerprint = "changed-input";
  if (kind === "output_change") candidate.steps[stepIndex].outputFingerprint = "changed-output";
  if (kind === "state_transition") candidate.steps[stepIndex].status = "retrying";
  if (kind === "missing_step") candidate.steps.splice(stepIndex, 1);
  return candidate;
}

let positives = 0;
let correctlyDetected = 0;
let correctlyClassified = 0;
let falsePositives = 0;
let outcomeOnlyDetected = 0;
const startedAt = process.hrtime.bigint();

for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
  const expectedKind = mutationKinds[iteration % mutationKinds.length];
  const baseline = makeRun(`run-${iteration}`);
  const candidate = mutate(baseline, expectedKind, iteration % 7);
  const comparison = compareTraceRuns(baseline, candidate);
  const hasMutation = expectedKind !== "none";
  const outcomeOnlyChanged = baseline.finalStatus !== candidate.finalStatus;

  if (hasMutation) {
    positives += 1;
    if (comparison.firstDivergence) correctlyDetected += 1;
    if (
      comparison.firstDivergence?.kind ===
      (expectedKind as TraceDivergenceKind)
    ) {
      correctlyClassified += 1;
    }
    if (outcomeOnlyChanged) outcomeOnlyDetected += 1;
  } else if (comparison.firstDivergence) {
    falsePositives += 1;
  }
}

const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
const report = {
  benchmark: "trace-divergence-v1",
  iterations: ITERATIONS,
  positiveCases: positives,
  structuredTrace: {
    detectionRecall: correctlyDetected / positives,
    classificationAccuracy: correctlyClassified / positives,
    falsePositiveRate: falsePositives / (ITERATIONS - positives),
  },
  outcomeOnlyBaseline: {
    detectionRecall: outcomeOnlyDetected / positives,
    note: "All mutated runs deliberately retain the same final status.",
  },
  performance: {
    totalMs: Number(elapsedMs.toFixed(2)),
    comparisonsPerSecond: Math.round(ITERATIONS / (elapsedMs / 1000)),
    meanMicrosecondsPerComparison: Number(
      ((elapsedMs * 1000) / ITERATIONS).toFixed(3),
    ),
  },
  scope:
    "Synthetic deterministic mutations across tool, input, output, state, and missing-step branches; this does not measure semantic model quality.",
};

console.log(JSON.stringify(report, null, 2));
