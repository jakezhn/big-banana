import Link from "next/link";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { loadDashboardAgentRuns } from "../../src/dashboard/load-dashboard-data";

export const dynamic = "force-dynamic";

export default async function AgentRunsPage() {
  const apiBaseUrl = getApiBaseUrl();
  const agentRuns = await loadDashboardAgentRuns(50);
  const summaryCards = buildSummaryCards(agentRuns);
  const latestFailedRun = agentRuns.find((run) => run.status !== "success") ?? null;
  const latestEligibleRun =
    agentRuns.find((run) => run.executionEligible === true) ?? null;
  const runMixRows = buildRunMixRows(agentRuns);

  return (
    <main className="dashboard-shell">
      <section className="hero-panel hero-panel-compact">
        <div>
          <p className="eyebrow">Agent Runs</p>
          <h1>Recent planner runs</h1>
          <p className="hero-copy">
            Audit view for deterministic and future AI planner calls, including
            status, latency, and linked plan versions.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/" className="action-link">
            Back to Overview
          </Link>
          <Link
            href={`${apiBaseUrl}/api/dashboard/agent-runs?limit=50`}
            className="action-link action-link-muted"
          >
            View Agent Runs API
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Snapshot</p>
            <h2>Recent run health</h2>
          </div>
        </div>
        <div className="card-grid">
          {summaryCards.map(([label, value]) => (
            <article key={label} className="metric-card">
              <p className="metric-label">{label}</p>
              <p className="metric-value metric-value-compact">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Focus</p>
            <h2>What needs attention</h2>
          </div>
        </div>
        <div className="detail-grid detail-grid-tight">
          <article className="detail-card">
            <p className="metric-label">Latest failure</p>
            {latestFailedRun ? (
              <div className="callout-stack">
                <div className="callout-panel callout-panel-danger">
                  <p className="callout-title">
                    {latestFailedRun.marketKey} · {latestFailedRun.status}
                  </p>
                  <p>{truncate(latestFailedRun.errorMessage ?? "Unknown failure", 220)}</p>
                </div>
                <dl className="detail-list">
                  <div className="detail-list-row">
                    <dt>Skill</dt>
                    <dd>{latestFailedRun.skillName ?? latestFailedRun.operation}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>Prompt</dt>
                    <dd>{latestFailedRun.promptVersion ?? "—"}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>Started</dt>
                    <dd>{formatTimestamp(latestFailedRun.startedAt)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="empty-cell">No failed runs in the current sample.</p>
            )}
          </article>
          <article className="detail-card">
            <p className="metric-label">Latest execution-ready plan</p>
            {latestEligibleRun ? (
              <div className="callout-stack">
                <div className="callout-panel">
                  <p className="callout-title">
                    {latestEligibleRun.marketKey} · {latestEligibleRun.status}
                  </p>
                  <p>
                    {latestEligibleRun.skillName ?? latestEligibleRun.operation} via{" "}
                    {latestEligibleRun.model
                      ? `${latestEligibleRun.modelProvider ?? latestEligibleRun.runnerKind}:${latestEligibleRun.model}`
                      : latestEligibleRun.runnerKind}
                  </p>
                </div>
                <dl className="detail-list">
                  <div className="detail-list-row">
                    <dt>Prompt</dt>
                    <dd>{latestEligibleRun.promptVersion ?? "—"}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>Latency</dt>
                    <dd>{latestEligibleRun.latencyMs} ms</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>Plan Version</dt>
                    <dd>
                      {latestEligibleRun.tradePlanVersionId
                        ? shortenId(latestEligibleRun.tradePlanVersionId)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="empty-cell">No execution-eligible runs in the current sample.</p>
            )}
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Mix</p>
            <h2>Live, replay, and market breakdown</h2>
          </div>
        </div>
        <div className="detail-grid detail-grid-tight">
          <article className="detail-card">
            <p className="metric-label">Current mix</p>
            <dl className="detail-list">
              {runMixRows.map(([label, value]) => (
                <div key={label} className="detail-list-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="detail-card">
            <p className="metric-label">Why this matters</p>
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
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="table-wrap">
          <table className="data-table">
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
                <tr>
                  <td colSpan={11} className="empty-cell">
                    No agent runs available yet.
                  </td>
                </tr>
              ) : (
                agentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link
                        href={`/markets/${encodeURIComponent(run.marketKey)}`}
                        className="action-link action-link-inline"
                      >
                        {run.marketKey}
                      </Link>
                    </td>
                    <td>{run.operation}</td>
                    <td>{run.skillName ?? "—"}</td>
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
                        <span>{run.promptVersion ?? "—"}</span>
                        <span className="table-subtle">
                          {formatTokenUsage(run.tokenUsageJson)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-${run.status}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>{run.errorMessage ? truncate(run.errorMessage, 88) : "—"}</td>
                    <td>{formatEligible(run.executionEligible)}</td>
                    <td>{run.latencyMs} ms</td>
                    <td>{run.tradePlanVersionId ? shortenId(run.tradePlanVersionId) : "—"}</td>
                    <td>{formatTimestamp(run.startedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
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

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEligible(value: boolean | null): string {
  if (value === null) {
    return "—";
  }

  return value ? "yes" : "no";
}

function formatTokenUsage(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "usage unavailable";
  }

  const totalTokens = (value as { total_tokens?: unknown }).total_tokens;
  if (typeof totalTokens === "number") {
    return `${totalTokens.toLocaleString("en-US")} tokens`;
  }

  return "usage recorded";
}

function shortenId(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
