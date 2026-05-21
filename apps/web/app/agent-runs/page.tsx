import Link from "next/link";
import { getApiBaseUrl } from "../../src/api/get-api-base-url";
import { loadDashboardAgentRuns } from "../../src/dashboard/load-dashboard-data";

export const dynamic = "force-dynamic";

export default async function AgentRunsPage() {
  const apiBaseUrl = getApiBaseUrl();
  const agentRuns = await loadDashboardAgentRuns(50);

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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Operation</th>
                <th>Runner</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Plan Version</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {agentRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No agent runs available yet.
                  </td>
                </tr>
              ) : (
                agentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.marketKey}</td>
                    <td>{run.operation}</td>
                    <td>{run.model ? `${run.runnerKind}:${run.model}` : run.runnerKind}</td>
                    <td>
                      <span className={`status-pill status-${run.status}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>{run.latencyMs} ms</td>
                    <td>{run.tradePlanVersionId ?? "—"}</td>
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

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
