import type { JsonValue } from "@big-banana/domain";
import { parseReplayPlannerResultRef } from "./replay-planner-harness";

const ACTIONABLE_EXECUTION_STATES = new Set(["armed", "pending_entry"]);

export type ReplayPlannerQualitySlice = {
  totalRuns: number;
  executionEligibleCount: number;
  executionIneligibleCount: number;
  unknownExecutionEligibilityCount: number;
  actionableCount: number;
  watchCount: number;
  skipCount: number;
  createCount: number;
  patchCount: number;
  executionEligibleRate: number;
  actionableRate: number;
  watchRate: number;
  skipRate: number;
  createRate: number;
  patchRate: number;
};

export type ReplayPlannerQualityReport = {
  overall: ReplayPlannerQualitySlice;
  byMarket: Record<string, ReplayPlannerQualitySlice>;
  byTimeframe: Record<string, ReplayPlannerQualitySlice>;
  byPromptVersion: Record<string, ReplayPlannerQualitySlice>;
  byModel: Record<string, ReplayPlannerQualitySlice>;
};

export type ReplayPlannerQualityComparison = {
  overall: ReplayPlannerQualitySliceDelta;
  byMarket: Record<string, ReplayPlannerQualitySliceDelta>;
  byTimeframe: Record<string, ReplayPlannerQualitySliceDelta>;
};

export type ReplayPlannerQualitySliceDelta = {
  totalRunsDelta: number;
  executionEligibleRateDelta: number;
  actionableRateDelta: number;
  watchRateDelta: number;
  skipRateDelta: number;
  createRateDelta: number;
  patchRateDelta: number;
};

type MutableReplayPlannerQualitySlice = {
  totalRuns: number;
  executionEligibleCount: number;
  executionIneligibleCount: number;
  unknownExecutionEligibilityCount: number;
  actionableCount: number;
  watchCount: number;
  skipCount: number;
  createCount: number;
  patchCount: number;
};

export function buildReplayPlannerQualityReport(
  values: JsonValue[]
): ReplayPlannerQualityReport {
  const overall = createMutableSlice();
  const byMarket = new Map<string, MutableReplayPlannerQualitySlice>();
  const byTimeframe = new Map<string, MutableReplayPlannerQualitySlice>();
  const byPromptVersion = new Map<string, MutableReplayPlannerQualitySlice>();
  const byModel = new Map<string, MutableReplayPlannerQualitySlice>();

  for (const value of values) {
    const result = parseReplayPlannerResultRef(value);
    const promptVersion = result.promptVersion ?? "unknown";
    const model = result.model ?? "unknown";
    const timeframe = result.timeframe ?? "unknown";

    applyResultToSlice(overall, result);
    applyResultToSlice(getOrCreateSlice(byMarket, result.market), result);
    applyResultToSlice(getOrCreateSlice(byTimeframe, timeframe), result);
    applyResultToSlice(getOrCreateSlice(byPromptVersion, promptVersion), result);
    applyResultToSlice(getOrCreateSlice(byModel, model), result);
  }

  return {
    overall: finalizeSlice(overall),
    byMarket: finalizeRecord(byMarket),
    byTimeframe: finalizeRecord(byTimeframe),
    byPromptVersion: finalizeRecord(byPromptVersion),
    byModel: finalizeRecord(byModel)
  };
}

export function compareReplayPlannerQualityReports(
  baseline: ReplayPlannerQualityReport,
  candidate: ReplayPlannerQualityReport
): ReplayPlannerQualityComparison {
  return {
    overall: diffSlices(baseline.overall, candidate.overall),
    byMarket: diffRecords(baseline.byMarket, candidate.byMarket),
    byTimeframe: diffRecords(baseline.byTimeframe, candidate.byTimeframe)
  };
}

function diffRecords(
  baseline: Record<string, ReplayPlannerQualitySlice>,
  candidate: Record<string, ReplayPlannerQualitySlice>
): Record<string, ReplayPlannerQualitySliceDelta> {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  const result: Record<string, ReplayPlannerQualitySliceDelta> = {};

  for (const key of keys) {
    result[key] = diffSlices(
      baseline[key] ?? zeroSlice(),
      candidate[key] ?? zeroSlice()
    );
  }

  return result;
}

function diffSlices(
  baseline: ReplayPlannerQualitySlice,
  candidate: ReplayPlannerQualitySlice
): ReplayPlannerQualitySliceDelta {
  return {
    totalRunsDelta: candidate.totalRuns - baseline.totalRuns,
    executionEligibleRateDelta:
      candidate.executionEligibleRate - baseline.executionEligibleRate,
    actionableRateDelta: candidate.actionableRate - baseline.actionableRate,
    watchRateDelta: candidate.watchRate - baseline.watchRate,
    skipRateDelta: candidate.skipRate - baseline.skipRate,
    createRateDelta: candidate.createRate - baseline.createRate,
    patchRateDelta: candidate.patchRate - baseline.patchRate
  };
}

function finalizeRecord(
  slices: Map<string, MutableReplayPlannerQualitySlice>
): Record<string, ReplayPlannerQualitySlice> {
  return Object.fromEntries(
    [...slices.entries()].map(([key, slice]) => [key, finalizeSlice(slice)])
  );
}

function getOrCreateSlice(
  slices: Map<string, MutableReplayPlannerQualitySlice>,
  key: string
): MutableReplayPlannerQualitySlice {
  const existing = slices.get(key);

  if (existing) {
    return existing;
  }

  const created = createMutableSlice();
  slices.set(key, created);
  return created;
}

function applyResultToSlice(
  slice: MutableReplayPlannerQualitySlice,
  result: ReturnType<typeof parseReplayPlannerResultRef>
): void {
  slice.totalRuns += 1;

  if (result.executionEligible === true) {
    slice.executionEligibleCount += 1;
  } else if (result.executionEligible === false) {
    slice.executionIneligibleCount += 1;
  } else {
    slice.unknownExecutionEligibilityCount += 1;
  }

  if (ACTIONABLE_EXECUTION_STATES.has(result.executionState)) {
    slice.actionableCount += 1;
  }

  if (result.executionState === "watch") {
    slice.watchCount += 1;
  }

  if (result.action === "skip") {
    slice.skipCount += 1;
  }

  if (result.action === "create") {
    slice.createCount += 1;
  }

  if (result.action === "patch") {
    slice.patchCount += 1;
  }
}

function finalizeSlice(
  slice: MutableReplayPlannerQualitySlice
): ReplayPlannerQualitySlice {
  return {
    ...slice,
    executionEligibleRate: ratio(slice.executionEligibleCount, slice.totalRuns),
    actionableRate: ratio(slice.actionableCount, slice.totalRuns),
    watchRate: ratio(slice.watchCount, slice.totalRuns),
    skipRate: ratio(slice.skipCount, slice.totalRuns),
    createRate: ratio(slice.createCount, slice.totalRuns),
    patchRate: ratio(slice.patchCount, slice.totalRuns)
  };
}

function zeroSlice(): ReplayPlannerQualitySlice {
  return finalizeSlice(createMutableSlice());
}

function createMutableSlice(): MutableReplayPlannerQualitySlice {
  return {
    totalRuns: 0,
    executionEligibleCount: 0,
    executionIneligibleCount: 0,
    unknownExecutionEligibilityCount: 0,
    actionableCount: 0,
    watchCount: 0,
    skipCount: 0,
    createCount: 0,
    patchCount: 0
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}
