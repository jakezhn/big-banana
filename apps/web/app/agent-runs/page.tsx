import { Suspense } from "react";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { loadDashboardAgentRuns } from "../../src/dashboard/load-dashboard-data";
import {
  formatEligible,
  formatLatestTimestamp,
  formatTimestamp,
  formatTokenUsage,
  shortenId,
  truncate
} from "../../src/ui/format";
import {
  BlockEmptyState,
  DataTable,
  DebugLink,
  DetailCard,
  DetailGridSkeleton,
  DetailGrid,
  DetailList,
  InlineLink,
  LoadingSection,
  MetricGrid,
  MetricGridSkeleton,
  PageHero,
  PageMeta,
  PageShell,
  Section,
  StatusPill,
  TableSkeleton,
  TableEmptyState
} from "../../src/ui/primitives";

export const dynamic = "force-dynamic";

export default function AgentRunsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Agent Runs"
        title="Recent planner runs"
        copy="Audit view for deterministic and future AI planner calls, including status, latency, and linked plan versions."
        actions={[
          { href: "/", label: "Back to Overview" }
        ]}
      />
      <PageMeta />

      <Suspense fallback={<AgentRunsLoadingSections />}>
        <AgentRunsContent />
      </Suspense>
    </PageShell>
  );
}

async function AgentRunsContent() {
  const apiBaseUrl = getApiBaseUrl();
  const agentRuns = await loadDashboardAgentRuns(50);
  const summaryCards = buildSummaryCards(agentRuns);
  const latestFailedRun = agentRuns.find((run) => run.status !== "success") ?? null;
  const latestEligibleRun =
    agentRuns.find((run) => run.executionEligible === true) ?? null;
  const runMixRows = buildRunMixRows(agentRuns);
  const latestRunStartedAt = formatLatestTimestamp(
    agentRuns.map((run) => run.startedAt)
  );

  return (
    <>
      <Section kicker="Snapshot" title="Recent run health">
        <MetricGrid items={summaryCards} />
      </Section>

      <Section kicker="Focus" title="What needs attention">
        <DetailGrid tight>
          <DetailCard title="Latest failure">
            {latestFailedRun ? (
              <div className="callout-stack">
                <div className="callout-panel callout-panel-danger">
                  <p className="callout-title">
                    {latestFailedRun.marketKey} / {latestFailedRun.status}
                  </p>
                  <p>{truncate(latestFailedRun.errorMessage ?? "Unknown failure", 220)}</p>
                </div>
                <DetailList
                  rows={[
                    ["Skill", latestFailedRun.skillName ?? latestFailedRun.operation],
                    ["Prompt", latestFailedRun.promptVersion ?? "-"],
                    ["Started", formatTimestamp(latestFailedRun.startedAt)]
                  ]}
                />
              </div>
            ) : (
              <BlockEmptyState>No failed runs in the current sample.</BlockEmptyState>
            )}
          </DetailCard>
          <DetailCard title="Latest execution-ready plan">
            {latestEligibleRun ? (
              <div className="callout-stack">
                <div className="callout-panel">
                  <p className="callout-title">
                    {latestEligibleRun.marketKey} / {latestEligibleRun.status}
                  </p>
                  <p>
                    {latestEligibleRun.skillName ?? latestEligibleRun.operation} via{" "}
                    {latestEligibleRun.model
                      ? `${latestEligibleRun.modelProvider ?? latestEligibleRun.runnerKind}:${latestEligibleRun.model}`
                      : latestEligibleRun.runnerKind}
                  </p>
                </div>
                <DetailList
                  rows={[
                    ["Prompt", latestEligibleRun.promptVersion ?? "-"],
                    ["Latency", `${latestEligibleRun.latencyMs} ms`],
                    [
                      "Plan Version",
                      latestEligibleRun.tradePlanVersionId
                        ? shortenId(latestEligibleRun.tradePlanVersionId)
                        : "-"
                    ]
                  ]}
                />
              </div>
            ) : (
              <BlockEmptyState>
                No execution-eligible runs in the current sample.
              </BlockEmptyState>
            )}
          </DetailCard>
        </DetailGrid>
      </Section>

      <Section kicker="Mix" title="Live, replay, and market breakdown">
        <DetailGrid tight>
          <DetailCard title="Current mix">
            <DetailList rows={runMixRows} />
          </DetailCard>
          <DetailCard title="Why this matters">
            <div className="callout-stack">
              <div className="callout-panel">
                <p className="callout-title">Live runs</p>
                <p>
                  Use these to validate whether the current planner/runtime is producing
                  execution-ready plans on the actual webhook path.
                </p>
              </div>
              <div className="callout-panel">
                <p className="callout-title">Replay runs</p>
                <p>
                  Use these to compare prompt and model changes without polluting live
                  plan facts or paper orders.
                </p>
              </div>
            </div>
          </DetailCard>
        </DetailGrid>
      </Section>

      <Section
        kicker="Run Sample"
        title="Latest 50 agent runs"
        description={`Loaded ${agentRuns.length} agent run records. Rows include live and replay operations from the recent API sample. Latest run: ${latestRunStartedAt}.`}
        action={
          <DebugLink href={`${apiBaseUrl}/api/dashboard/agent-runs?limit=50`}>
            Agent Runs API
          </DebugLink>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <th>Market</th>
              <th>Operation</th>
              <th>Skill</th>
              <th>Runner</th>
              <th>Prompt</th>
              <th>Status</th>
              <th>Error</th>
              <th>Eligible</th>
              <th>Latency</th>
              <th>Plan Version</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {agentRuns.length === 0 ? (
              <TableEmptyState colSpan={11}>No agent runs available yet.</TableEmptyState>
            ) : (
              agentRuns.map((run) => (
                <tr key={run.id}>
                  <td>
                    <InlineLink href={`/markets/${encodeURIComponent(run.marketKey)}`}>
                      {run.marketKey}
                    </InlineLink>
                  </td>
                  <td>{run.operation}</td>
                  <td>{run.skillName ?? "-"}</td>
                  <td>
                    <div className="table-stack">
                      <span>
                        {run.model
                          ? `${run.modelProvider ?? run.runnerKind}:${run.model}`
                          : run.runnerKind}
                      </span>
                      <span className="table-subtle">{shortenId(run.id)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-stack">
                      <span>{run.promptVersion ?? "-"}</span>
                      <span className="table-subtle">
                        {formatTokenUsage(run.tokenUsageJson)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusPill value={run.status} />
                  </td>
                  <td>{run.errorMessage ? truncate(run.errorMessage, 88) : "-"}</td>
                  <td>{formatEligible(run.executionEligible)}</td>
                  <td>{run.latencyMs} ms</td>
                  <td>{run.tradePlanVersionId ? shortenId(run.tradePlanVersionId) : "-"}</td>
                  <td>{formatTimestamp(run.startedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </Section>
    </>
  );
}

function AgentRunsLoadingSections() {
  return (
    <>
      <LoadingSection kicker="Snapshot" title="Recent run health">
        <MetricGridSkeleton count={5} />
      </LoadingSection>
      <LoadingSection kicker="Focus" title="What needs attention">
        <DetailGridSkeleton count={2} />
      </LoadingSection>
      <LoadingSection kicker="Mix" title="Live, replay, and market breakdown">
        <DetailGridSkeleton count={2} />
      </LoadingSection>
      <LoadingSection
        kicker="Run Sample"
        title="Latest 50 agent runs"
        description="Loading planner run records from the dashboard read model."
      >
        <TableSkeleton columns={11} rows={7} />
      </LoadingSection>
    </>
  );
}

function buildSummaryCards(
  agentRuns: Awaited<ReturnType<typeof loadDashboardAgentRuns>>
): readonly (readonly [string, string])[] {
  const successCount = agentRuns.filter((run) => run.status === "success").length;
  const failureCount = agentRuns.filter((run) => run.status !== "success").length;
  const eligibleCount = agentRuns.filter(
    (run) => run.executionEligible === true
  ).length;
  const averageLatencyMs =
    agentRuns.length === 0
      ? 0
      : Math.round(
          agentRuns.reduce((total, run) => total + run.latencyMs, 0) /
            agentRuns.length
        );

  return [
    ["Runs Loaded", String(agentRuns.length)],
    ["Succeeded", String(successCount)],
    ["Non-Success", String(failureCount)],
    ["Execution Eligible", String(eligibleCount)],
    ["Average Latency", `${averageLatencyMs} ms`]
  ] as const;
}

function buildRunMixRows(
  agentRuns: Awaited<ReturnType<typeof loadDashboardAgentRuns>>
): readonly (readonly [string, string])[] {
  const replayRuns = agentRuns.filter((run) => run.operation === "plan.replay").length;
  const liveRuns = agentRuns.length - replayRuns;
  const openAiRuns = agentRuns.filter((run) => run.runnerKind === "openai").length;
  const cryptoRuns = agentRuns.filter((run) =>
    run.marketKey.startsWith("BINANCE:")
  ).length;

  return [
    ["Live Runs", String(liveRuns)],
    ["Replay Runs", String(replayRuns)],
    ["OpenAI Runs", String(openAiRuns)],
    ["BINANCE Markets", String(cryptoRuns)]
  ] as const;
}
