import { createHmac } from "node:crypto";

export type TraceDivergenceKind =
  | "missing_step"
  | "tool_branch"
  | "input_change"
  | "output_change"
  | "state_transition";

export type TraceStepFingerprint = {
  stepIndex: number;
  stage: string;
  toolCalled: string;
  inputFingerprint: string;
  outputFingerprint: string;
  status: string;
  durationMs: number;
};

export type TraceRun = {
  id: string;
  label: string;
  tenantId: string;
  workflowVersion: string;
  policyVersion: string;
  release: string;
  finalStatus: string;
  steps: TraceStepFingerprint[];
};

export type TraceDivergence = {
  stepIndex: number;
  kind: TraceDivergenceKind;
  severity: "warning" | "critical";
  baseline: string;
  candidate: string;
  explanation: string;
};

export type TraceComparison = {
  baseline: TraceRun;
  candidate: TraceRun;
  firstDivergence: TraceDivergence | null;
  divergences: TraceDivergence[];
  matchedSteps: number;
  totalSteps: number;
  downstreamStepsAffected: number;
  outcomeOnlyWouldMiss: boolean;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

/**
 * Produces a stable, non-reversible payload fingerprint.
 *
 * Only the fingerprint is persisted. Production deployments should always
 * provide TRACE_HMAC_SECRET; the fallback exists solely for the public,
 * simulated dataset.
 */
export function fingerprintTracePayload(
  payload: unknown,
  secret = process.env.TRACE_HMAC_SECRET ?? "resolveops-public-demo-only",
): string {
  return createHmac("sha256", secret)
    .update(canonicalize(payload))
    .digest("hex")
    .slice(0, 24);
}

function divergence(
  stepIndex: number,
  kind: TraceDivergenceKind,
  baseline: string,
  candidate: string,
): TraceDivergence {
  const messages: Record<TraceDivergenceKind, string> = {
    missing_step: "One run skipped or inserted an execution step.",
    tool_branch: "The workflow selected a different tool branch.",
    input_change: "The tool received a different input fingerprint.",
    output_change: "The same tool returned a different output fingerprint.",
    state_transition: "The step completed in a different workflow state.",
  };
  return {
    stepIndex,
    kind,
    severity:
      kind === "tool_branch" || kind === "missing_step" ? "critical" : "warning",
    baseline,
    candidate,
    explanation: messages[kind],
  };
}

export function compareTraceRuns(
  baseline: TraceRun,
  candidate: TraceRun,
): TraceComparison {
  const divergences: TraceDivergence[] = [];
  const baselineByIndex = new Map(
    baseline.steps.map((step) => [step.stepIndex, step]),
  );
  const candidateByIndex = new Map(
    candidate.steps.map((step) => [step.stepIndex, step]),
  );
  const stepIndexes = [
    ...new Set([...baselineByIndex.keys(), ...candidateByIndex.keys()]),
  ].sort((left, right) => left - right);
  const totalSteps = stepIndexes.length;
  let matchedSteps = 0;

  for (const stepIndex of stepIndexes) {
    const expected = baselineByIndex.get(stepIndex);
    const actual = candidateByIndex.get(stepIndex);

    if (!expected || !actual) {
      divergences.push(
        divergence(
          stepIndex,
          "missing_step",
          expected?.toolCalled ?? "missing",
          actual?.toolCalled ?? "missing",
        ),
      );
      continue;
    }
    if (expected.toolCalled !== actual.toolCalled) {
      divergences.push(
        divergence(
          stepIndex,
          "tool_branch",
          expected.toolCalled,
          actual.toolCalled,
        ),
      );
      continue;
    }
    if (expected.inputFingerprint !== actual.inputFingerprint) {
      divergences.push(
        divergence(
          stepIndex,
          "input_change",
          expected.inputFingerprint,
          actual.inputFingerprint,
        ),
      );
      continue;
    }
    if (expected.outputFingerprint !== actual.outputFingerprint) {
      divergences.push(
        divergence(
          stepIndex,
          "output_change",
          expected.outputFingerprint,
          actual.outputFingerprint,
        ),
      );
      continue;
    }
    if (expected.status !== actual.status) {
      divergences.push(
        divergence(
          stepIndex,
          "state_transition",
          expected.status,
          actual.status,
        ),
      );
      continue;
    }
    matchedSteps += 1;
  }

  const firstDivergence = divergences[0] ?? null;
  return {
    baseline,
    candidate,
    firstDivergence,
    divergences,
    matchedSteps,
    totalSteps,
    downstreamStepsAffected: firstDivergence
      ? stepIndexes.filter((stepIndex) => stepIndex > firstDivergence.stepIndex)
          .length
      : 0,
    outcomeOnlyWouldMiss:
      Boolean(firstDivergence) &&
      baseline.finalStatus === candidate.finalStatus,
  };
}
