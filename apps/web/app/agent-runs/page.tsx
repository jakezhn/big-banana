import Link from "next/link";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { loadDashboardAgentRuns } from "../../src/dashboard/load-dashboard-data";

export const dynamic = "force-dynamic";

export default async function AgentRunsPage() {
  const apiBaseUrl = getApiBaseUrl();
  const agentRuns = await loadDashboardAgentRuns(50);
  const summaryCards = buildSummaryCards(agentRuns);

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
